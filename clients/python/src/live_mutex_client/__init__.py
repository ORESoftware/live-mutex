"""
Python asyncio client for the live-mutex broker.

Speaks the broker's NDJSON-over-TCP wire protocol. A single Client
instance multiplexes any number of concurrent acquire/release/
acquire-many requests over one connection by correlating on a
per-request UUID.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

PROTOCOL_VERSION = "0.2.25"


class LiveMutexError(Exception):
    """Base error for protocol-level failures (broker rejection, etc.)."""


class ConnectionClosedError(LiveMutexError):
    """Raised when an in-flight request is interrupted by socket close."""


@dataclass
class LockGrant:
    key: str
    lock_uuid: str
    fencing_token: Optional[int] = None
    lock_request_count: Optional[int] = None


@dataclass
class AcquireManyGrant:
    keys: List[str]
    lock_uuid: str
    fencing_tokens: Dict[str, int] = field(default_factory=dict)


class Client:
    """
    Async live-mutex client.

    Use as either a context manager (`async with Client.connect(...) as c`)
    or by calling `connect()` and `close()` explicitly. Methods may be
    called concurrently from different coroutines — all wire traffic
    goes through a single underlying TCP socket.
    """

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter,
                 *, request_timeout: float = 60.0):
        self._reader = reader
        self._writer = writer
        self._request_timeout = request_timeout
        self._inflight: Dict[str, asyncio.Future[Dict[str, Any]]] = {}
        self._reader_task: Optional[asyncio.Task[None]] = None
        self._closed = False

    @classmethod
    async def connect(cls, host: str = "127.0.0.1", port: int = 6970,
                      *, request_timeout: float = 60.0) -> "Client":
        reader, writer = await asyncio.open_connection(host, port)
        # TCP_NODELAY mirrors the canonical broker default — without it
        # short-payload acquires get coalesced by Nagle and round-trip
        # latency triples on Linux.
        try:
            sock = writer.get_extra_info("socket")
            if sock is not None:
                import socket as _s
                sock.setsockopt(_s.IPPROTO_TCP, _s.TCP_NODELAY, 1)
        except Exception:
            pass
        client = cls(reader, writer, request_timeout=request_timeout)
        # Send version handshake before anything else so the broker
        # doesn't drop us with version-mismatch.
        client._send({"type": "version", "value": PROTOCOL_VERSION})
        await writer.drain()
        client._reader_task = asyncio.create_task(client._read_loop())
        return client

    # --------------- public API ---------------

    async def acquire(self, key: str, *, ttl_ms: Optional[int] = None,
                      max_concurrency: Optional[int] = None) -> LockGrant:
        request_uuid = str(uuid.uuid4())
        payload: Dict[str, Any] = {
            "type": "lock",
            "uuid": request_uuid,
            "key": key,
            "ttl": ttl_ms,
            "pid": os.getpid(),
            "keepLocksAfterDeath": False,
        }
        if max_concurrency is not None:
            payload["max"] = max_concurrency
        reply = await self._await_reply(request_uuid, payload)
        if not reply.get("acquired"):
            raise LiveMutexError(reply.get("error") or "lock not acquired")
        return LockGrant(
            key=key,
            lock_uuid=request_uuid,
            fencing_token=reply.get("fencingToken"),
            lock_request_count=reply.get("lockRequestCount"),
        )

    async def release(self, key: str, lock_uuid: str, *, force: bool = False) -> None:
        request_uuid = str(uuid.uuid4())
        payload = {
            "type": "unlock",
            "uuid": request_uuid,
            "_uuid": lock_uuid,
            "key": key,
            "force": force,
        }
        reply = await self._await_reply(request_uuid, payload)
        if not reply.get("unlocked"):
            raise LiveMutexError(reply.get("error") or "unlock rejected")

    async def acquire_many(self, keys: List[str], *, ttl_ms: Optional[int] = None) -> AcquireManyGrant:
        if not keys:
            raise ValueError("acquire_many requires a non-empty list of keys")
        request_uuid = str(uuid.uuid4())
        payload = {
            "type": "acquire-many",
            "uuid": request_uuid,
            "keys": list(keys),
            "ttl": ttl_ms,
        }
        reply = await self._await_reply(request_uuid, payload)
        if not reply.get("acquired"):
            why = reply.get("error") or (
                f"contended on {reply.get('contendedKey')}" if reply.get("contendedKey") else "acquire-many rejected"
            )
            raise LiveMutexError(why)
        return AcquireManyGrant(
            keys=list(reply.get("keys") or keys),
            lock_uuid=str(reply.get("lockUuid") or ""),
            fencing_tokens={k: int(v) for k, v in (reply.get("fencingTokens") or {}).items()},
        )

    async def release_many(self, lock_uuid: str) -> None:
        request_uuid = str(uuid.uuid4())
        payload = {
            "type": "release-many",
            "uuid": request_uuid,
            "lockUuid": lock_uuid,
        }
        reply = await self._await_reply(request_uuid, payload)
        if not reply.get("released"):
            raise LiveMutexError(reply.get("error") or "release-many rejected")

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            self._writer.close()
            await self._writer.wait_closed()
        except Exception:
            pass
        if self._reader_task is not None:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except (asyncio.CancelledError, Exception):
                pass

    async def __aenter__(self) -> "Client":
        return self

    async def __aexit__(self, *_args: Any) -> None:
        await self.close()

    # --------------- internals ---------------

    def _send(self, payload: Dict[str, Any]) -> None:
        self._writer.write((json.dumps(payload) + "\n").encode("utf-8"))

    async def _await_reply(self, request_uuid: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[Dict[str, Any]] = loop.create_future()
        self._inflight[request_uuid] = fut
        try:
            self._send(payload)
            await self._writer.drain()
            return await asyncio.wait_for(fut, timeout=self._request_timeout)
        finally:
            self._inflight.pop(request_uuid, None)

    async def _read_loop(self) -> None:
        try:
            while True:
                line = await self._reader.readline()
                if not line:
                    break
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(msg, dict):
                    continue
                request_uuid = msg.get("uuid")
                if not isinstance(request_uuid, str):
                    continue
                fut = self._inflight.get(request_uuid)
                if fut is not None and not fut.done():
                    fut.set_result(msg)
        finally:
            # Surface socket close to every waiter so they don't hang
            # forever if the broker dies mid-flight.
            for fut in list(self._inflight.values()):
                if not fut.done():
                    fut.set_exception(ConnectionClosedError("connection closed"))


__all__ = [
    "PROTOCOL_VERSION",
    "Client",
    "LockGrant",
    "AcquireManyGrant",
    "LiveMutexError",
    "ConnectionClosedError",
]
