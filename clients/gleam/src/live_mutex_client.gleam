//// Top-level Gleam client for the live-mutex broker (Broker1). The transport
//// is the Erlang FFI in `live_mutex_client_ffi.erl` (uses `gen_tcp` in
//// `{packet, line}` mode so a single recv returns one full JSON frame).
////
//// The client is *synchronous* per call (one outstanding request at a time
//// per connection) — enough for cross-runtime conformance testing and keeps
//// the Gleam side small. For high-fanout workloads open multiple connections.

import gleam/dict.{type Dict}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import live_mutex_client/protocol.{
  type Request, type Response, AcquireManyRequest, AcquireManyResponse,
  LockRequest, LockResponse, ReleaseManyRequest, ReleaseManyResponse,
  UnlockRequest, UnlockResponse, VersionRequest,
}

pub type Connection

@external(erlang, "live_mutex_client_ffi", "connect")
fn ffi_connect(
  host: String,
  port: Int,
  timeout_ms: Int,
) -> Result(Connection, String)

@external(erlang, "live_mutex_client_ffi", "close")
fn ffi_close(conn: Connection) -> Nil

@external(erlang, "live_mutex_client_ffi", "send_line")
fn ffi_send_line(conn: Connection, line: String) -> Result(Nil, String)

@external(erlang, "live_mutex_client_ffi", "recv_line")
fn ffi_recv_line(conn: Connection, timeout_ms: Int) -> Result(String, String)

@external(erlang, "live_mutex_client_ffi", "new_uuid")
pub fn new_uuid() -> String

@external(erlang, "live_mutex_client_ffi", "getpid")
fn ffi_getpid() -> Int

pub type Client {
  Client(conn: Connection)
}

pub type LockHandle {
  LockHandle(key: String, lock_uuid: String, fencing_token: Int)
}

pub type CompositeLockHandle {
  CompositeLockHandle(
    keys: List(String),
    lock_uuid: String,
    fencing_tokens: Dict(String, Int),
  )
}

/// Dials the broker and sends the (fire-and-forget) version handshake. The
/// broker only replies on a version mismatch, so there's nothing to await.
pub fn connect(host: String, port: Int) -> Result(Client, String) {
  use conn <- result.try(ffi_connect(host, port, 5000))
  let client = Client(conn)
  let line = protocol.encode_request(VersionRequest(value: "0.2.25"))
  use _ <- result.try(ffi_send_line(client.conn, line))
  Ok(client)
}

pub fn close(client: Client) -> Nil {
  ffi_close(client.conn)
}

fn send_and_recv(
  client: Client,
  req: Request,
  timeout_ms: Int,
) -> Result(Response, String) {
  let line = protocol.encode_request(req)
  use _ <- result.try(ffi_send_line(client.conn, line))
  use raw <- result.try(ffi_recv_line(client.conn, timeout_ms))
  protocol.decode_response(raw)
}

/// Sends a request, then keeps reading replies for it until the broker grants
/// the lock (`acquired:true`) or hard-rejects it (`acquired:false` with an
/// error). A contended waiter is held broker-side and replies exactly once.
fn send_until_grant(
  client: Client,
  req: Request,
  timeout_ms: Int,
) -> Result(Response, String) {
  let line = protocol.encode_request(req)
  use _ <- result.try(ffi_send_line(client.conn, line))
  recv_until_grant(client, timeout_ms)
}

fn recv_until_grant(
  client: Client,
  timeout_ms: Int,
) -> Result(Response, String) {
  use raw <- result.try(ffi_recv_line(client.conn, timeout_ms))
  use resp <- result.try(protocol.decode_response(raw))
  case resp {
    LockResponse(_, _, True, _, _, _) -> Ok(resp)
    LockResponse(_, _, _, _, _, Some(_)) -> Ok(resp)
    LockResponse(_, _, _, _, _, _) -> recv_until_grant(client, timeout_ms)
    AcquireManyResponse(_, _, True, _, _, _, _) -> Ok(resp)
    AcquireManyResponse(_, _, _, _, _, Some(_), _) -> Ok(resp)
    AcquireManyResponse(_, _, _, _, _, _, Some(_)) -> Ok(resp)
    AcquireManyResponse(_, _, _, _, _, _, _) ->
      recv_until_grant(client, timeout_ms)
    other -> Ok(other)
  }
}

/// Exclusive lock (or a semaphore slot when `max > 1`).
pub fn acquire(
  client: Client,
  key: String,
  ttl_ms: Int,
) -> Result(LockHandle, String) {
  acquire_with_max(client, key, ttl_ms, None)
}

pub fn acquire_with_max(
  client: Client,
  key: String,
  ttl_ms: Int,
  max: Option(Int),
) -> Result(LockHandle, String) {
  let req =
    LockRequest(
      uuid: new_uuid(),
      key: key,
      pid: ffi_getpid(),
      ttl: ttl_for(ttl_ms),
      max: max,
      keep_locks_after_death: False,
    )
  use resp <- result.try(send_until_grant(client, req, 30_000))
  case resp {
    LockResponse(u, _, True, Some(ft), _, _) -> Ok(LockHandle(key, u, ft))
    LockResponse(u, _, True, None, _, _) -> Ok(LockHandle(key, u, 0))
    LockResponse(_, _, False, _, _, Some(e)) -> Error("acquire rejected: " <> e)
    _ -> Error("acquire: unexpected response")
  }
}

pub fn release(client: Client, handle: LockHandle) -> Result(Nil, String) {
  let req =
    UnlockRequest(
      uuid: new_uuid(),
      key: handle.key,
      lock_uuid: handle.lock_uuid,
      force: False,
    )
  use resp <- result.try(send_and_recv(client, req, 5000))
  case resp {
    UnlockResponse(_, True, _) -> Ok(Nil)
    UnlockResponse(_, False, Some(e)) -> Error("release rejected: " <> e)
    _ -> Error("release: unexpected response")
  }
}

pub fn acquire_many(
  client: Client,
  keys: List(String),
  ttl_ms: Int,
) -> Result(CompositeLockHandle, String) {
  case list.length(keys) {
    0 -> Error("acquire_many requires at least one key")
    _ -> {
      let req =
        AcquireManyRequest(uuid: new_uuid(), keys: keys, ttl: ttl_for(ttl_ms))
      use resp <- result.try(send_until_grant(client, req, 30_000))
      case resp {
        AcquireManyResponse(_, ks, True, Some(lu), Some(ft), _, _) ->
          Ok(CompositeLockHandle(ks, lu, ft))
        AcquireManyResponse(_, ks, True, Some(lu), None, _, _) ->
          Ok(CompositeLockHandle(ks, lu, dict.new()))
        AcquireManyResponse(_, _, False, _, _, _, Some(e)) ->
          Error("acquire_many rejected: " <> e)
        AcquireManyResponse(_, _, False, _, _, Some(ck), _) ->
          Error("acquire_many contended on " <> ck)
        _ -> Error("acquire_many: unexpected response")
      }
    }
  }
}

pub fn release_many(
  client: Client,
  handle: CompositeLockHandle,
) -> Result(Nil, String) {
  let req = ReleaseManyRequest(uuid: new_uuid(), lock_uuid: handle.lock_uuid)
  use resp <- result.try(send_and_recv(client, req, 5000))
  case resp {
    ReleaseManyResponse(_, True, _) -> Ok(Nil)
    ReleaseManyResponse(_, False, Some(e)) ->
      Error("release_many rejected: " <> e)
    _ -> Error("release_many: unexpected response")
  }
}

fn ttl_for(ttl_ms: Int) -> Option(Int) {
  case ttl_ms > 0 {
    True -> Some(ttl_ms)
    False -> None
  }
}
