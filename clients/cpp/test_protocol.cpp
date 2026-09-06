// Offline protocol unit tests — no broker / network required.
//
//   make test && ./build/test_protocol
//
// Verifies request framing and response parsing against the broker's
// newline-delimited JSON contract, including 64-bit fencing-token precision.
#include <cassert>
#include <iostream>
#include <string>

#include "live_mutex/protocol.hpp"

using namespace lmx;

static int failures = 0;

static void check(bool cond, const std::string& what) {
  if (!cond) {
    std::cerr << "  FAIL: " << what << "\n";
    ++failures;
  }
}

int main() {
  // version handshake
  {
    auto f = version_frame();
    check(f.find("\"type\":\"version\"") != std::string::npos, "version type");
    check(f.find("\"value\":\"0.2.25\"") != std::string::npos, "version value");
  }

  // lock request shape (default ttl => null, no max)
  {
    auto f = lock_request("u1", "k1", 4242, 0, std::nullopt);
    check(f.find("\"type\":\"lock\"") != std::string::npos, "lock type");
    check(f.find("\"uuid\":\"u1\"") != std::string::npos, "lock uuid");
    check(f.find("\"key\":\"k1\"") != std::string::npos, "lock key");
    check(f.find("\"pid\":4242") != std::string::npos, "lock pid");
    check(f.find("\"ttl\":null") != std::string::npos, "lock ttl null");
    check(f.find("\"max\"") == std::string::npos, "lock omits max when unset");
  }

  // lock request with ttl + max
  {
    auto f = lock_request("u2", "k2", 1, 1500, std::optional<uint32_t>(3));
    check(f.find("\"ttl\":1500") != std::string::npos, "lock ttl set");
    check(f.find("\"max\":3") != std::string::npos, "lock max set");
  }

  // unlock request uses _uuid for the held lock id
  {
    auto f = unlock_request("u3", "k3", "held-uuid", true);
    check(f.find("\"type\":\"unlock\"") != std::string::npos, "unlock type");
    check(f.find("\"_uuid\":\"held-uuid\"") != std::string::npos, "unlock _uuid");
    check(f.find("\"force\":true") != std::string::npos, "unlock force");
  }

  // acquire-many request
  {
    auto f = acquire_many_request("u4", {"a", "b"}, 2000);
    check(f.find("\"type\":\"acquire-many\"") != std::string::npos, "acquire-many type");
    check(f.find("\"keys\":[\"a\",\"b\"]") != std::string::npos, "acquire-many keys");
    check(f.find("\"ttl\":2000") != std::string::npos, "acquire-many ttl");
  }

  // release-many request
  {
    auto f = release_many_request("u5", "lock-uuid-9");
    check(f.find("\"type\":\"release-many\"") != std::string::npos, "release-many type");
    check(f.find("\"lockUuid\":\"lock-uuid-9\"") != std::string::npos, "release-many lockUuid");
  }

  // lock grant parse + 64-bit fencing precision
  {
    auto r = Response::parse(
        R"({"type":"lock","uuid":"u1","acquired":true,"fencingToken":9007199254740993,"lockRequestCount":2})");
    check(r.type == ResponseType::Lock, "parse lock type");
    check(r.acquired, "parse acquired");
    check(r.fencing_token == 9007199254740993ULL, "parse 64-bit fencing token (no double rounding)");
    check(r.lock_request_count == 2, "parse lockRequestCount");
  }

  // unlock reply
  {
    auto r = Response::parse(R"({"uuid":"u3","unlocked":true})");
    check(r.unlocked, "parse unlocked");
    check(r.type == ResponseType::Unlock, "parse unlock type");
  }

  // acquire-many grant
  {
    auto r = Response::parse(
        R"({"uuid":"u4","acquired":true,"lockUuid":"L","keys":["a","b"],"fencingTokens":{"a":10,"b":11}})");
    check(r.acquired, "parse am acquired");
    check(r.lock_uuid == "L", "parse am lockUuid");
    check(r.keys.size() == 2, "parse am keys");
    check(r.fencing_tokens["a"] == 10 && r.fencing_tokens["b"] == 11, "parse am fencingTokens");
  }

  // release-many reply
  {
    auto r = Response::parse(R"({"uuid":"u5","released":true})");
    check(r.released, "parse released");
  }

  // rejection carries error
  {
    auto r = Response::parse(R"({"type":"lock","uuid":"u9","acquired":false,"error":"max must be >= 1"})");
    check(!r.acquired && r.error == "max must be >= 1", "parse rejection error");
  }

  if (failures == 0) {
    std::cout << "✅ [test-cpp] all protocol tests passed\n";
    return 0;
  }
  std::cerr << "[test-cpp] " << failures << " failure(s)\n";
  return 1;
}
