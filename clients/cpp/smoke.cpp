// End-to-end smoke test for the C++ live-mutex client.
//
//   make smoke && ./build/smoke
//
// Override host/port via LMX_HOST / LMX_PORT (defaults 127.0.0.1:7970).
#include <atomic>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>
#include <vector>

#include "live_mutex/client.hpp"

static std::string env_or(const char* key, const std::string& def) {
  const char* v = std::getenv(key);
  return (v && *v) ? std::string(v) : def;
}

int main() {
  std::string host = env_or("LMX_HOST", "127.0.0.1");
  int port = std::stoi(env_or("LMX_PORT", "7970"));

  try {
    auto client = lmx::Client::connect(host, port);
    std::cout << "[smoke-cpp] connected " << host << ":" << port << "\n";

    auto a = client->acquire("smoke-cpp-1", 5000);
    if (a.fencing_token < 1) throw lmx::LiveMutexError("missing fencing token");
    std::cout << "[smoke-cpp] acquire #1: lockUuid=" << a.lock_uuid
              << " fencing=" << a.fencing_token << "\n";
    client->release(a);

    auto b = client->acquire("smoke-cpp-1", 5000);
    if (b.fencing_token <= a.fencing_token)
      throw lmx::LiveMutexError("fencing token did not increase across handoff");
    std::cout << "[smoke-cpp] acquire #2: fencing=" << b.fencing_token
              << " (> " << a.fencing_token << ")\n";
    client->release(b);

    auto comp = client->acquire_many({"smoke-cpp-a", "smoke-cpp-b", "smoke-cpp-c"}, 5000);
    std::cout << "[smoke-cpp] acquire_many: lockUuid=" << comp.lock_uuid << " tokens={";
    for (const auto& [k, v] : comp.fencing_tokens) std::cout << k << ":" << v << " ";
    std::cout << "}\n";
    client->release_many(comp);
    std::cout << "[smoke-cpp] released composite\n";

    // Contention check: N threads on one hot key must never overlap.
    constexpr int kWorkers = 6;
    std::atomic<int> in_section{0};
    std::atomic<bool> overlap{false};
    std::atomic<int> grants{0};
    std::vector<std::thread> ts;
    for (int i = 0; i < kWorkers; ++i) {
      ts.emplace_back([&] {
        for (int j = 0; j < 5; ++j) {
          auto h = client->acquire("smoke-cpp-hot", 5000);
          if (in_section.fetch_add(1) != 0) overlap = true;
          std::this_thread::sleep_for(std::chrono::microseconds(200));
          in_section.fetch_sub(1);
          grants.fetch_add(1);
          client->release(h);
        }
      });
    }
    for (auto& t : ts) t.join();
    if (overlap) throw lmx::LiveMutexError("mutual exclusion violated under contention");
    std::cout << "[smoke-cpp] mutual exclusion held across " << grants.load()
              << " grants on a hot key\n";

    client->close();
    std::cout << "✅ [smoke-cpp] OK\n";
    return 0;
  } catch (const std::exception& e) {
    std::cerr << "[smoke-cpp] FAILED: " << e.what() << "\n";
    return 1;
  }
}
