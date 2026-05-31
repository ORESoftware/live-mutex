// Wire protocol for the live-mutex broker (Broker1), C++ edition.
//
// The broker speaks newline-delimited JSON. Request `type` values are the
// kebab-case strings the broker matches on; every request carries a `uuid`
// that the matching reply echoes back so a single connection can multiplex
// concurrent requests. Mirrors clients/go/livemutex/client.go.
#pragma once

#include <map>
#include <optional>
#include <string>
#include <vector>

#include "json.hpp"

namespace lmx {

// Sent in the version handshake. The broker only rejects strictly-older
// clients, so bumping this is forward-safe.
inline constexpr const char* kProtocolVersion = "0.2.25";

enum class ResponseType { Lock, Unlock, AcquireMany, ReleaseMany, VersionMismatch, Other };

struct Response {
  ResponseType type = ResponseType::Other;
  std::string uuid;         // correlation id (echoes the request uuid)
  std::string raw_type;     // the broker's `type` string, verbatim
  bool acquired = false;    // lock / acquire-many grant flag
  bool unlocked = false;    // unlock reply flag
  bool released = false;    // release-many reply flag
  std::string lock_uuid;    // acquire-many grant handle
  uint64_t fencing_token = 0;
  uint64_t lock_request_count = 0;
  std::vector<std::string> keys;
  std::map<std::string, uint64_t> fencing_tokens;
  std::string error;
  std::string contended_key;
  json::Value raw;

  static Response parse(const std::string& line) {
    Response r;
    r.raw = json::Parser(line).parse();
    r.uuid = r.raw.str_or("uuid");
    r.raw_type = r.raw.str_or("type");
    r.acquired = r.raw.bool_or("acquired");
    r.unlocked = r.raw.bool_or("unlocked");
    r.released = r.raw.bool_or("released");
    r.lock_uuid = r.raw.str_or("lockUuid");
    r.fencing_token = r.raw.u64_or("fencingToken");
    r.lock_request_count = r.raw.u64_or("lockRequestCount");
    r.error = r.raw.str_or("error");
    r.contended_key = r.raw.str_or("contendedKey");

    if (const json::Value* ks = r.raw.find("keys"); ks && ks->type() == json::Type::Array) {
      for (const auto& v : ks->as_array())
        if (v.type() == json::Type::String) r.keys.push_back(v.as_string());
    }
    if (const json::Value* ft = r.raw.find("fencingTokens"); ft && ft->type() == json::Type::Object) {
      for (const auto& [k, v] : ft->as_object())
        if (v.type() == json::Type::Number) r.fencing_tokens[k] = v.as_u64();
    }

    if (r.raw_type == "lock") r.type = ResponseType::Lock;
    else if (r.raw_type == "unlock" || r.raw.contains("unlocked")) r.type = ResponseType::Unlock;
    else if (r.raw_type == "version-mismatch") r.type = ResponseType::VersionMismatch;
    else if (r.raw.contains("released")) r.type = ResponseType::ReleaseMany;
    else if (r.raw.contains("fencingTokens") || (r.raw.contains("lockUuid") && r.raw.contains("acquired")))
      r.type = ResponseType::AcquireMany;
    return r;
  }
};

inline std::string version_frame() {
  json::Object o;
  o["type"] = std::string("version");
  o["value"] = std::string(kProtocolVersion);
  return json::Value(std::move(o)).dump();
}

inline std::string lock_request(const std::string& uuid, const std::string& key, int pid,
                                uint64_t ttl_ms, std::optional<uint32_t> max_holders) {
  json::Object o;
  o["type"] = std::string("lock");
  o["uuid"] = uuid;
  o["key"] = key;
  o["pid"] = static_cast<int64_t>(pid);
  o["keepLocksAfterDeath"] = false;
  if (ttl_ms > 0) o["ttl"] = static_cast<uint64_t>(ttl_ms);
  else o["ttl"] = nullptr;
  if (max_holders) o["max"] = static_cast<uint64_t>(*max_holders);
  return json::Value(std::move(o)).dump();
}

inline std::string unlock_request(const std::string& uuid, const std::string& key,
                                  const std::string& lock_uuid, bool force) {
  json::Object o;
  o["type"] = std::string("unlock");
  o["uuid"] = uuid;
  o["_uuid"] = lock_uuid;
  o["key"] = key;
  o["force"] = force;
  return json::Value(std::move(o)).dump();
}

inline std::string acquire_many_request(const std::string& uuid,
                                        const std::vector<std::string>& keys, uint64_t ttl_ms) {
  json::Array arr;
  for (const auto& k : keys) arr.push_back(json::Value(k));
  json::Object o;
  o["type"] = std::string("acquire-many");
  o["uuid"] = uuid;
  o["keys"] = json::Value(std::move(arr));
  if (ttl_ms > 0) o["ttl"] = static_cast<uint64_t>(ttl_ms);
  else o["ttl"] = nullptr;
  return json::Value(std::move(o)).dump();
}

inline std::string release_many_request(const std::string& uuid, const std::string& lock_uuid) {
  json::Object o;
  o["type"] = std::string("release-many");
  o["uuid"] = uuid;
  o["lockUuid"] = lock_uuid;
  return json::Value(std::move(o)).dump();
}

}  // namespace lmx
