//// Wire protocol for the live-mutex broker (Broker1), Gleam edition.
////
//// Gleam custom types are real algebraic data types, so every `case` over a
//// `Request`/`Response` is checked for exhaustiveness by the compiler — the
//// strongest "no magic strings" guarantee of any of the clients. The broker
//// speaks newline-delimited JSON; request `type` values are the kebab-case
//// strings the broker matches on, and every reply echoes the request `uuid`.

import gleam/dict.{type Dict}
import gleam/dynamic/decode
import gleam/json.{type Json}
import gleam/option.{type Option, None, Some}
import gleam/result

// ---------- Request ------------------------------------------------------

pub type Request {
  VersionRequest(value: String)
  LockRequest(
    uuid: String,
    key: String,
    pid: Int,
    ttl: Option(Int),
    max: Option(Int),
    keep_locks_after_death: Bool,
  )
  UnlockRequest(uuid: String, key: String, lock_uuid: String, force: Bool)
  AcquireManyRequest(uuid: String, keys: List(String), ttl: Option(Int))
  ReleaseManyRequest(uuid: String, lock_uuid: String)
}

fn opt_int(field: String, value: Option(Int)) -> List(#(String, Json)) {
  case value {
    Some(v) -> [#(field, json.int(v))]
    None -> [#(field, json.null())]
  }
}

fn opt_int_omit(field: String, value: Option(Int)) -> List(#(String, Json)) {
  case value {
    Some(v) -> [#(field, json.int(v))]
    None -> []
  }
}

pub fn encode_request(req: Request) -> String {
  let body = case req {
    VersionRequest(value) -> [
      #("type", json.string("version")),
      #("value", json.string(value)),
    ]
    LockRequest(uuid, key, pid, ttl, max, keep_locks_after_death) ->
      [
        #("type", json.string("lock")),
        #("uuid", json.string(uuid)),
        #("key", json.string(key)),
        #("pid", json.int(pid)),
        #("keepLocksAfterDeath", json.bool(keep_locks_after_death)),
      ]
      |> append(opt_int("ttl", ttl))
      |> append(opt_int_omit("max", max))
    UnlockRequest(uuid, key, lock_uuid, force) -> [
      #("type", json.string("unlock")),
      #("uuid", json.string(uuid)),
      #("_uuid", json.string(lock_uuid)),
      #("key", json.string(key)),
      #("force", json.bool(force)),
    ]
    AcquireManyRequest(uuid, keys, ttl) ->
      [
        #("type", json.string("acquire-many")),
        #("uuid", json.string(uuid)),
        #("keys", json.array(keys, json.string)),
      ]
      |> append(opt_int("ttl", ttl))
    ReleaseManyRequest(uuid, lock_uuid) -> [
      #("type", json.string("release-many")),
      #("uuid", json.string(uuid)),
      #("lockUuid", json.string(lock_uuid)),
    ]
  }
  json.to_string(json.object(body))
}

fn append(a: List(b), b: List(b)) -> List(b) {
  case b {
    [] -> a
    _ -> list_concat(a, b)
  }
}

@external(erlang, "lists", "append")
fn list_concat(a: List(b), b: List(b)) -> List(b)

// ---------- Response -----------------------------------------------------

pub type Response {
  LockResponse(
    uuid: String,
    key: String,
    acquired: Bool,
    fencing_token: Option(Int),
    lock_request_count: Int,
    error: Option(String),
  )
  UnlockResponse(uuid: String, unlocked: Bool, error: Option(String))
  AcquireManyResponse(
    uuid: String,
    keys: List(String),
    acquired: Bool,
    lock_uuid: Option(String),
    fencing_tokens: Option(Dict(String, Int)),
    contended_key: Option(String),
    error: Option(String),
  )
  ReleaseManyResponse(uuid: String, released: Bool, error: Option(String))
  VersionMismatchResponse(uuid: String)
  OtherResponse(uuid: String, type_tag: String)
}

pub fn response_uuid(resp: Response) -> String {
  case resp {
    LockResponse(uuid, ..) -> uuid
    UnlockResponse(uuid, ..) -> uuid
    AcquireManyResponse(uuid, ..) -> uuid
    ReleaseManyResponse(uuid, ..) -> uuid
    VersionMismatchResponse(uuid) -> uuid
    OtherResponse(uuid, ..) -> uuid
  }
}

fn dec_optional_string(
  name: String,
  next: fn(Option(String)) -> decode.Decoder(a),
) -> decode.Decoder(a) {
  decode.optional_field(name, None, decode.optional(decode.string), next)
}

fn dec_optional_int(
  name: String,
  next: fn(Option(Int)) -> decode.Decoder(a),
) -> decode.Decoder(a) {
  decode.optional_field(name, None, decode.optional(decode.int), next)
}

fn dec_string_default(
  name: String,
  default: String,
  next: fn(String) -> decode.Decoder(a),
) -> decode.Decoder(a) {
  decode.optional_field(name, default, decode.string, next)
}

fn dec_int_default(
  name: String,
  default: Int,
  next: fn(Int) -> decode.Decoder(a),
) -> decode.Decoder(a) {
  decode.optional_field(name, default, decode.int, next)
}

fn dec_bool_default(
  name: String,
  default: Bool,
  next: fn(Bool) -> decode.Decoder(a),
) -> decode.Decoder(a) {
  decode.optional_field(name, default, decode.bool, next)
}

fn dec_list_string(
  name: String,
  next: fn(List(String)) -> decode.Decoder(a),
) -> decode.Decoder(a) {
  decode.optional_field(name, [], decode.list(decode.string), next)
}

pub fn decode_response(line: String) -> Result(Response, String) {
  json.parse(line, response_decoder())
  |> result.map_error(fn(_) { "decode failed: " <> line })
}

fn response_decoder() -> decode.Decoder(Response) {
  use type_tag <- decode.field("type", decode.string)
  use uuid <- decode.optional_field("uuid", "", decode.string)
  case type_tag {
    "lock" -> {
      use key <- dec_string_default("key", "")
      use acquired <- dec_bool_default("acquired", False)
      use ft <- dec_optional_int("fencingToken")
      use lrc <- dec_int_default("lockRequestCount", 0)
      use err <- dec_optional_string("error")
      decode.success(LockResponse(uuid, key, acquired, ft, lrc, err))
    }
    "unlock" -> {
      use unlocked <- dec_bool_default("unlocked", False)
      use err <- dec_optional_string("error")
      decode.success(UnlockResponse(uuid, unlocked, err))
    }
    "acquire-many" -> {
      use keys <- dec_list_string("keys")
      use acquired <- dec_bool_default("acquired", False)
      use lu <- dec_optional_string("lockUuid")
      use ft <- decode.optional_field(
        "fencingTokens",
        None,
        decode.optional(decode.dict(decode.string, decode.int)),
      )
      use ck <- dec_optional_string("contendedKey")
      use err <- dec_optional_string("error")
      decode.success(AcquireManyResponse(uuid, keys, acquired, lu, ft, ck, err))
    }
    "release-many" -> {
      use released <- dec_bool_default("released", False)
      use err <- dec_optional_string("error")
      decode.success(ReleaseManyResponse(uuid, released, err))
    }
    "version-mismatch" -> decode.success(VersionMismatchResponse(uuid))
    other -> decode.success(OtherResponse(uuid, other))
  }
}
