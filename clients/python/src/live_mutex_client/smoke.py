"""
Smoke test for the Python live-mutex client.

Run with `python -m live_mutex_client.smoke` after the broker is
listening on `127.0.0.1:6970` (override with `LMX_HOST`/`LMX_PORT`).
Exits 0 on success, 1 on assertion failure.
"""

from __future__ import annotations

import asyncio
import os
import sys

from . import Client


async def main() -> int:
    host = os.environ.get("LMX_HOST", "127.0.0.1")
    port = int(os.environ.get("LMX_PORT", "6970"))

    async with await Client.connect(host, port) as client:
        g1 = await client.acquire("py-smoke", ttl_ms=5_000)
        print(f"acquire #1: lock_uuid={g1.lock_uuid} fencing_token={g1.fencing_token}")
        assert g1.fencing_token and g1.fencing_token >= 1, "missing fencing token"
        await client.release("py-smoke", g1.lock_uuid)

        g2 = await client.acquire("py-smoke")
        print(f"acquire #2: lock_uuid={g2.lock_uuid} fencing_token={g2.fencing_token}")
        assert g2.fencing_token and g1.fencing_token and g2.fencing_token > g1.fencing_token, \
            "fencing tokens must be strictly monotonic per key"
        await client.release("py-smoke", g2.lock_uuid)

        many = await client.acquire_many(["py-many-a", "py-many-b", "py-many-c"], ttl_ms=5_000)
        print(f"acquire_many: lock_uuid={many.lock_uuid} fencing_tokens={many.fencing_tokens}")
        assert len(many.fencing_tokens) == 3, "expected one token per key"
        await client.release_many(many.lock_uuid)

    print("\u2705 python client smoke test passed")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
