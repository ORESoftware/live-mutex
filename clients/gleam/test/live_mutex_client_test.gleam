//// Run with `gleam test`. Offline protocol tests always run; the live smoke
//// is gated on LIVE_MUTEX_SMOKE=1 and talks to a broker on
//// LMX_HOST/LMX_PORT (defaults 127.0.0.1:7970).

import gleam/dict
import gleam/int
import gleam/io
import gleam/option.{None, Some}
import gleam/string
import gleeunit
import gleeunit/should
import live_mutex_client as lmx
import live_mutex_client/protocol as p

pub fn main() {
  gleeunit.main()
}

pub fn encode_lock_request_uses_ts_shape_test() {
  let req =
    p.LockRequest(
      uuid: "u",
      key: "k",
      pid: 42,
      ttl: None,
      max: None,
      keep_locks_after_death: False,
    )
  let encoded = p.encode_request(req)
  should.equal(string.contains(encoded, "\"type\":\"lock\""), True)
  should.equal(string.contains(encoded, "\"key\":\"k\""), True)
  should.equal(string.contains(encoded, "\"keepLocksAfterDeath\":false"), True)
  should.equal(string.contains(encoded, "\"ttl\":null"), True)
  should.equal(string.contains(encoded, "\"max\""), False)
}

pub fn encode_unlock_uses_underscore_uuid_test() {
  let req =
    p.UnlockRequest(uuid: "u", key: "k", lock_uuid: "held", force: False)
  let encoded = p.encode_request(req)
  should.equal(string.contains(encoded, "\"type\":\"unlock\""), True)
  should.equal(string.contains(encoded, "\"_uuid\":\"held\""), True)
}

pub fn encode_acquire_many_test() {
  let req = p.AcquireManyRequest(uuid: "u", keys: ["a", "b"], ttl: Some(2000))
  let encoded = p.encode_request(req)
  should.equal(string.contains(encoded, "\"type\":\"acquire-many\""), True)
  should.equal(string.contains(encoded, "\"keys\":[\"a\",\"b\"]"), True)
  should.equal(string.contains(encoded, "\"ttl\":2000"), True)
}

pub fn decode_lock_grant_test() {
  let raw =
    "{\"type\":\"lock\",\"uuid\":\"u\",\"acquired\":true,\"fencingToken\":1780241723170,\"lockRequestCount\":1}"
  let assert Ok(p.LockResponse(_, _, True, Some(ft), _, _)) =
    p.decode_response(raw)
  // Large (>32-bit) fencing token survives decode intact.
  should.equal(ft, 1_780_241_723_170)
}

pub fn decode_acquire_many_grant_test() {
  let raw =
    "{\"type\":\"acquire-many\",\"uuid\":\"u\",\"keys\":[\"a\",\"b\"],\"acquired\":true,\"lockUuid\":\"L\",\"fencingTokens\":{\"a\":1,\"b\":2}}"
  let assert Ok(p.AcquireManyResponse(_, _, True, Some(lu), Some(_), _, _)) =
    p.decode_response(raw)
  should.equal(lu, "L")
}

pub fn decode_unlock_test() {
  let raw = "{\"type\":\"unlock\",\"uuid\":\"u\",\"unlocked\":true}"
  let assert Ok(p.UnlockResponse(_, True, _)) = p.decode_response(raw)
  should.equal(True, True)
}

pub fn smoke_lifecycle_test() {
  case env_or_empty("LIVE_MUTEX_SMOKE") {
    "1" -> run_smoke()
    _ -> {
      io.println("[smoke-gleam] skipped (set LIVE_MUTEX_SMOKE=1)")
      Nil
    }
  }
}

fn run_smoke() -> Nil {
  let host = env_or("LMX_HOST", "127.0.0.1")
  let port = case int.parse(env_or("LMX_PORT", "7970")) {
    Ok(n) -> n
    Error(_) -> 7970
  }
  let assert Ok(client) = lmx.connect(host, port)
  io.println("[smoke-gleam] connected " <> host)

  let assert Ok(h1) = lmx.acquire(client, "smoke-gleam-1", 5000)
  should.equal(h1.fencing_token > 0, True)
  io.println("[smoke-gleam] acquire #1 fencing=" <> int.to_string(h1.fencing_token))
  let assert Ok(_) = lmx.release(client, h1)

  let assert Ok(h2) = lmx.acquire(client, "smoke-gleam-1", 5000)
  should.equal(h2.fencing_token > h1.fencing_token, True)
  io.println("[smoke-gleam] acquire #2 fencing=" <> int.to_string(h2.fencing_token))
  let assert Ok(_) = lmx.release(client, h2)

  let assert Ok(comp) =
    lmx.acquire_many(client, ["smoke-gleam-a", "smoke-gleam-b"], 5000)
  io.println(
    "[smoke-gleam] composite grant "
    <> comp.lock_uuid
    <> " ("
    <> int.to_string(dict.size(comp.fencing_tokens))
    <> " tokens)",
  )
  let assert Ok(_) = lmx.release_many(client, comp)

  lmx.close(client)
  io.println("[smoke-gleam] OK")
}

@external(erlang, "live_mutex_client_ffi_helpers", "getenv")
fn ffi_getenv(name: String) -> Result(String, Nil)

fn env_or(name: String, default: String) -> String {
  case ffi_getenv(name) {
    Ok(v) -> v
    Error(_) -> default
  }
}

fn env_or_empty(name: String) -> String {
  env_or(name, "")
}
