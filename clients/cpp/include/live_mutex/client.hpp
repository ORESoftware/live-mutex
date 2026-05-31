// Multiplexed TCP client for the live-mutex broker (header-only, C++17).
//
// One Client is safe to share across threads: writes are serialized and a
// background reader thread fans broker frames out to per-request queues keyed
// by the correlation uuid (mirrors the Go client's inflight map).
//
// Covers the Broker1 wire features used by the other clients: fencing tokens,
// acquire-many / release-many, and broker-side max validation. RW locks and
// the legacy lock-received ack are intentionally omitted — the broker's
// centralised TTL sweeper handles clients that skip the ack.
#pragma once

#include <netdb.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <sys/socket.h>
#include <unistd.h>

#include <atomic>
#include <condition_variable>
#include <cstring>
#include <deque>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <random>
#include <stdexcept>
#include <string>
#include <thread>
#include <unistd.h>
#include <vector>

#include "protocol.hpp"

namespace lmx {

class LiveMutexError : public std::runtime_error {
 public:
  explicit LiveMutexError(const std::string& m) : std::runtime_error(m) {}
};

struct LockHandle {
  std::string key;
  std::string lock_uuid;  // for a single lock this equals the request uuid
  uint64_t fencing_token = 0;
  uint64_t lock_request_count = 0;
};

struct CompositeLockHandle {
  std::vector<std::string> keys;
  std::string lock_uuid;
  std::map<std::string, uint64_t> fencing_tokens;
};

inline std::string new_uuid() {
  static thread_local std::mt19937_64 rng{std::random_device{}()};
  std::uniform_int_distribution<uint64_t> dist;
  uint64_t hi = dist(rng), lo = dist(rng);
  unsigned char b[16];
  for (int i = 0; i < 8; ++i) b[i] = (hi >> (8 * i)) & 0xFF;
  for (int i = 0; i < 8; ++i) b[8 + i] = (lo >> (8 * i)) & 0xFF;
  b[6] = (b[6] & 0x0F) | 0x40;  // version 4
  b[8] = (b[8] & 0x3F) | 0x80;  // variant
  static const char* hex = "0123456789abcdef";
  std::string out;
  out.reserve(36);
  for (int i = 0; i < 16; ++i) {
    if (i == 4 || i == 6 || i == 8 || i == 10) out.push_back('-');
    out.push_back(hex[b[i] >> 4]);
    out.push_back(hex[b[i] & 0x0F]);
  }
  return out;
}

class Client {
 public:
  static std::shared_ptr<Client> connect(const std::string& host = "127.0.0.1", int port = 7970) {
    addrinfo hints{};
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    addrinfo* res = nullptr;
    std::string port_s = std::to_string(port);
    if (getaddrinfo(host.c_str(), port_s.c_str(), &hints, &res) != 0 || !res)
      throw LiveMutexError("getaddrinfo failed for " + host + ":" + port_s);

    int fd = -1;
    for (addrinfo* p = res; p; p = p->ai_next) {
      fd = ::socket(p->ai_family, p->ai_socktype, p->ai_protocol);
      if (fd < 0) continue;
      if (::connect(fd, p->ai_addr, p->ai_addrlen) == 0) break;
      ::close(fd);
      fd = -1;
    }
    freeaddrinfo(res);
    if (fd < 0) throw LiveMutexError("connect failed for " + host + ":" + port_s);

    int one = 1;
    ::setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));

    auto c = std::shared_ptr<Client>(new Client(fd));
    c->reader_ = std::thread([c] { c->read_loop(); });
    c->send(version_frame());  // fire-and-forget handshake
    return c;
  }

  ~Client() { close(); }

  LockHandle acquire(const std::string& key, uint64_t ttl_ms = 0,
                     std::optional<uint32_t> max_holders = std::nullopt) {
    std::string uuid = new_uuid();
    Response r = roundtrip_grant(lock_request(uuid, key, getpid(), ttl_ms, max_holders), uuid);
    if (!r.acquired)
      throw LiveMutexError("lock(" + key + ") not acquired: " +
                           (r.error.empty() ? r.raw.dump() : r.error));
    return {key, uuid, r.fencing_token, r.lock_request_count};
  }

  void release(const LockHandle& h, bool force = false) {
    std::string uuid = new_uuid();
    Response r = roundtrip(unlock_request(uuid, h.key, h.lock_uuid, force), uuid);
    if (!r.unlocked)
      throw LiveMutexError("unlock(" + h.key + ") rejected: " +
                           (r.error.empty() ? r.raw.dump() : r.error));
  }

  CompositeLockHandle acquire_many(const std::vector<std::string>& keys, uint64_t ttl_ms = 0) {
    if (keys.empty()) throw LiveMutexError("acquire_many requires at least one key");
    std::string uuid = new_uuid();
    Response r = roundtrip_grant(acquire_many_request(uuid, keys, ttl_ms), uuid);
    if (!r.acquired) {
      std::string why = !r.error.empty() ? r.error
                        : !r.contended_key.empty() ? "contended on " + r.contended_key
                                                   : "rejected";
      throw LiveMutexError("acquire_many " + why);
    }
    CompositeLockHandle h;
    h.lock_uuid = r.lock_uuid;
    h.keys = r.keys.empty() ? keys : r.keys;
    h.fencing_tokens = r.fencing_tokens;
    return h;
  }

  void release_many(const CompositeLockHandle& h) {
    std::string uuid = new_uuid();
    Response r = roundtrip(release_many_request(uuid, h.lock_uuid), uuid);
    if (!r.released)
      throw LiveMutexError("release-many rejected: " + (r.error.empty() ? r.raw.dump() : r.error));
  }

  void close() {
    bool expected = false;
    if (!closed_.compare_exchange_strong(expected, true)) return;
    if (fd_ >= 0) {
      ::shutdown(fd_, SHUT_RDWR);
      ::close(fd_);
    }
    {
      std::lock_guard<std::mutex> lk(mu_);
      for (auto& [uuid, slot] : inflight_) slot->done = true;
      cv_.notify_all();
    }
    if (reader_.joinable() && std::this_thread::get_id() != reader_.get_id()) reader_.join();
  }

 private:
  struct Slot {
    std::deque<Response> q;
    bool done = false;
  };

  explicit Client(int fd) : fd_(fd) {}

  int fd_;
  std::thread reader_;
  std::mutex wmu_;
  std::mutex mu_;
  std::condition_variable cv_;
  std::map<std::string, std::shared_ptr<Slot>> inflight_;
  std::atomic<bool> closed_{false};
  std::string read_err_;

  std::shared_ptr<Slot> register_slot(const std::string& uuid) {
    auto slot = std::make_shared<Slot>();
    std::lock_guard<std::mutex> lk(mu_);
    if (closed_) throw LiveMutexError("client closed");
    inflight_[uuid] = slot;
    return slot;
  }

  void unregister(const std::string& uuid) {
    std::lock_guard<std::mutex> lk(mu_);
    inflight_.erase(uuid);
  }

  void send(const std::string& payload) {
    std::string frame = payload;
    frame.push_back('\n');
    std::lock_guard<std::mutex> lk(wmu_);
    size_t off = 0;
    while (off < frame.size()) {
      ssize_t n = ::send(fd_, frame.data() + off, frame.size() - off, 0);
      if (n <= 0) throw LiveMutexError("send failed");
      off += static_cast<size_t>(n);
    }
  }

  Response next(const std::shared_ptr<Slot>& slot) {
    std::unique_lock<std::mutex> lk(mu_);
    cv_.wait(lk, [&] { return !slot->q.empty() || slot->done; });
    if (!slot->q.empty()) {
      Response r = slot->q.front();
      slot->q.pop_front();
      return r;
    }
    throw LiveMutexError(read_err_.empty() ? "client closed" : read_err_);
  }

  Response roundtrip(const std::string& frame, const std::string& uuid) {
    auto slot = register_slot(uuid);
    struct Guard {
      Client* c;
      std::string u;
      ~Guard() { c->unregister(u); }
    } guard{this, uuid};
    send(frame);
    return next(slot);
  }

  // Waits past interim "queued" notices: returns on a grant (acquired:true)
  // or a hard rejection (acquired:false WITH an error).
  Response roundtrip_grant(const std::string& frame, const std::string& uuid) {
    auto slot = register_slot(uuid);
    struct Guard {
      Client* c;
      std::string u;
      ~Guard() { c->unregister(u); }
    } guard{this, uuid};
    send(frame);
    for (;;) {
      Response r = next(slot);
      if (r.acquired) return r;
      if (!r.error.empty() || !r.contended_key.empty()) return r;
      // acquired:false with no error => still queued; keep waiting.
    }
  }

  void read_loop() {
    std::string buf;
    char chunk[65536];
    while (!closed_) {
      ssize_t n = ::recv(fd_, chunk, sizeof(chunk), 0);
      if (n <= 0) break;
      buf.append(chunk, static_cast<size_t>(n));
      size_t pos;
      while ((pos = buf.find('\n')) != std::string::npos) {
        std::string line = buf.substr(0, pos);
        buf.erase(0, pos + 1);
        if (line.empty()) continue;
        try {
          dispatch(Response::parse(line));
        } catch (const std::exception& e) {
          read_err_ = e.what();
        }
      }
    }
    close();
  }

  void dispatch(Response r) {
    if (r.uuid.empty()) return;
    std::lock_guard<std::mutex> lk(mu_);
    auto it = inflight_.find(r.uuid);
    if (it == inflight_.end()) return;
    it->second->q.push_back(std::move(r));
    cv_.notify_all();
  }
};

}  // namespace lmx
