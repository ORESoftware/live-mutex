# live-mutex C++ client

Header-only, dependency-free C++17 client for the live-mutex broker
(`Broker1`). Speaks the broker's newline-delimited JSON wire protocol and
multiplexes concurrent requests over a single TCP connection by correlating
on a per-request `uuid` (mirrors `clients/go`).

## Layout

```
include/live_mutex/json.hpp       minimal JSON parser/serializer (64-bit safe)
include/live_mutex/protocol.hpp   request framing + response parsing
include/live_mutex/client.hpp     multiplexed TCP client
smoke.cpp                         live end-to-end smoke (needs a broker)
test_protocol.cpp                 offline protocol unit tests (no broker)
```

## Build & test

```sh
make test                       # offline protocol tests, no broker needed
LMX_PORT=7970 make run          # live smoke against a running broker
```

Requires a C++17 compiler (`clang++` or `g++`). No third-party dependencies.

## Usage

```cpp
#include "live_mutex/client.hpp"

auto client = lmx::Client::connect("127.0.0.1", 7970);

// Exclusive lock with a 5s TTL; returns a fencing token.
auto h = client->acquire("my-key", 5000);
// ... critical section guarded by h.fencing_token ...
client->release(h);

// Semaphore (max 3 concurrent holders).
auto s = client->acquire("rate-limit", 5000, /*max=*/3);
client->release(s);

// Atomic multi-key (composite) lock.
auto c = client->acquire_many({"a", "b", "c"}, 5000);
client->release_many(c);
```

## Notes

- 64-bit fencing tokens are preserved exactly (numbers are parsed from their
  source text, never round-tripped through a `double`).
- `acquire`/`acquire_many` block until the broker grants the lock; a hard
  rejection (e.g. `max < 1`) surfaces as an `lmx::LiveMutexError`.
- RW locks and the legacy `lock-received` ack are intentionally omitted; the
  broker's centralised TTL sweeper reclaims holders that disconnect.
