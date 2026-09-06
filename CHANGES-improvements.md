# live-mutex broker improvements (`feat/sweeper-fencing-acquire-many-http`)

Companion changes to the Rust port at `remote/deployments/rust-network-mutex-rs`.
This branch ports the broker-side wins back upstream so both implementations
share the same wire protocol and operational story.

## What changed

### 1. Single broker-wide TTL sweeper (replaces per-holder `setTimeout`)

Before: every grant armed its own `setTimeout(ttl)` and each unlock had to
`clearTimeout` the matching handle. With N concurrent holders that's N live
timers and an O(N) clear path on shutdown / connection drop.

After: every grant inserts a row into `broker.holderDeadlines: Map<uuid, {key, expiresAt}>`.
A single `setInterval(25ms)` sweeper (`Broker1.startTtlSweeper`) walks the
map every tick, evicts every row whose `expiresAt <= Date.now()`, calls
`ensureNewLockHolder` to wake the next waiter, and increments
`ttlEvictionsTotal`.

The sweeper handle is `unref()`'d so it never blocks process exit. It's
started both in the constructor (so `noListen` brokers used by tests get
eviction too) and again in the listen callback (idempotent — second call
is a no-op).

`Broker1.tickTtl(now?)` is exposed publicly so tests can drive eviction
synchronously without leaning on `setInterval` timing.

### 2. Per-key monotonic fencing tokens

Every successful grant now mints a per-key strictly-monotonic token
(`LockObj.nextFencingToken`, never resets). The token is included in:

- `{type:"lock", acquired:true, fencingToken: …}` over TCP.
- `LockGrant.fencingToken` on the Promise-returning JS client API
  (`Client.acquire` / `Client.lock`).
- `acquire-many` responses (one token per key in the `fencingTokens` map).
- `POST /v1/lock` and `POST /v1/acquire-many` HTTP responses.

A holder reading its token can detect stale handoffs — if the broker
reports a strictly-greater token for the same key, the prior hold was
evicted (TTL or `force`) and a successor is in charge. Old broker
versions return `null`, which clients should treat as "fencing unknown".

### 3. Broker-side `max` / `maxRead` / `maxWrite` validation

Before: `max:0` silently became `1` (`max || 1` in `getDefaultLockObject`),
`max:-3` was stored verbatim and made `count >= -3` always true so every
caller queued forever. Negative values were a foot-gun with no
diagnostic.

After: `Broker1.validateMaxField` rejects `max < 1` (and the same for
`maxRead` / `maxWrite`) up-front with
`{type:"lock", acquired:false, error:"`max` must be a positive integer …"}`.
No `LockObj` is mutated; the request is purely synchronously failed.
Error path is identical over TCP, the JS client, and the HTTP front-end
(HTTP returns 400).

### 4. `acquire-many` / `release-many` (union semantics)

New wire types:

```json
client → broker: {"type":"acquire-many", "uuid", "keys":[…], "ttl"?}
broker → client: {"type":"acquire-many", "uuid", "keys", "acquired":true,
                 "lockUuid":"<broker-minted>", "fencingTokens":{key:token}}
              | {"type":"acquire-many", "uuid", "keys", "acquired":false,
                 "contendedKey":"…"}
              | {"type":"acquire-many", "uuid", "keys", "acquired":false, "error":"…"}

client → broker: {"type":"release-many", "uuid", "lockUuid":"…"}
broker → client: {"type":"release-many", "uuid", "lockUuid", "keys",
                 "released":true}
```

Semantics: union — every key is held simultaneously, but each member is a
separate per-key holder under one umbrella `lockUuid`. The broker
acquires keys in **sorted order** to avoid deadlock between concurrent
multi-key callers, and rolls back any keys it grabbed if a later key in
the request is contended (returning the contended key in
`contendedKey`).

Hard cap of 64 keys per request (bounds the rollback path and the
fencing-tokens object size).

### 5. HTTP front-end on a separate port + status page + Prometheus

New files `src/http-server.ts` (`LMXHttpServer`) and
`src/in-process-bridge.ts` (`InProcessBridge`). Off by default; opt
in with `LMX_HTTP_PORT` (and optionally `LMX_HTTP_HOST`). Mounted by
`lm-start-server.ts`.

**The HTTP layer is in-memory, not TCP-loopback.** Every
`/v1/{lock,unlock,acquire-many,release-many}` is a direct method
call on the broker via `InProcessBridge` — no TCP, no fresh sockets,
no version handshake, no Nagle. The bridge holds one virtual
`net.Socket`-shaped object that is registered with the broker the
same way a real TCP connection would be (`connectedClients`,
`wsToKeys`, `wsToUUIDs`); on `bridge.shutdown()` we run the
broker's regular `cleanupConnection` path so HTTP-acquired holds
follow the same ownership rules as TCP-acquired holds. This matches
what the Rust port (`rust-network-mutex-rs`) has always done: HTTP
handlers there call `state.broker.handle_request(client_id, request)`
through an in-memory `mpsc` channel, not a loopback socket.

`/healthz`, `/metrics`, `/v1/stats`, and the status page bypass even
the bridge — they answer directly from `broker.buildStatsSnapshot()`
and `broker.renderPrometheus()`.

Verification: `test/in-process-bridge-test.ts` constructs a broker
with `noListen: true` (no TCP listener at all), wires up
`LMXHttpServer` in front of it, and verifies that
`POST /v1/lock`, `/v1/unlock`, `acquire-many`, `release-many`, and
`max:0`-validation all work. If the HTTP layer were going through
loopback, none of those calls could complete because there'd be no
broker port to dial.

Routes:

| Route                | Method | Body                                        | Effect |
|----------------------|--------|---------------------------------------------|--------|
| `/`, `/status`       | GET    | —                                           | HTML status page (auto-refresh 5s) |
| `/v1/stats`          | GET    | —                                           | Same data as the HTML page, JSON   |
| `/healthz` `/health` | GET    | —                                           | `{ok: true, isOpen}` for liveness  |
| `/metrics`           | GET    | —                                           | Prometheus exposition (`lmx_*`)    |
| `/v1/lock`           | POST   | `{key, ttl?, max?}`                         | acquire single key                 |
| `/v1/unlock`         | POST   | `{key, lockUuid?, force?}`                  | release; `lockUuid` optional with `force:true` |
| `/v1/acquire-many`   | POST   | `{keys:[…], ttl?}`                          | acquire union of keys              |
| `/v1/release-many`   | POST   | `{lockUuid}`                                | release a previous acquire-many    |

Implementation: `lock` / `unlock` go through an in-process `Client`
connected to the broker over loopback. `acquire-many` / `release-many`
open a one-shot TCP socket per request (the JS `Client` doesn't model
multi-key responses, so we write the wire frame directly). `/healthz`,
`/metrics`, `/v1/stats`, and `/` answer directly from `broker.buildStatsSnapshot()`
without any client round-trip.

The HTML page mirrors the layout of `dd-rust-network-mutex`'s status
page (so dashboards work across both implementations) and is rendered
server-side with full HTML-escaping of dynamic values (`esc()`) — keys
are user-supplied and could contain HTML.

Prometheus metrics emitted (all prefixed `lmx_`):

```
lmx_keys                          gauge
lmx_holders                       gauge
lmx_readers                       gauge
lmx_waiters                       gauge
lmx_clients                       gauge
lmx_pending_deadlines             gauge
lmx_ttl_evictions_total           counter
lmx_max_concurrency_cap           gauge
lmx_concurrency_cap_clamps_total  counter
lmx_composite_locks_held          gauge
lmx_uptime_seconds                gauge
```

## Cross-runtime clients

`clients/{rust,python,go,dart,java}` — minimal but production-shaped
clients in five languages. Each one supports `acquire`, `release`,
`acquire_many`, `release_many` and surfaces fencing tokens on the
response. See `clients/README.md` for the protocol crib sheet and how
to run the per-language smoke tests.

The Rust, Python and Go clients are verified end-to-end against this
broker (smoke tests pass). Dart and Java are structurally complete
(mirror the working three) but the build was not exercised here
because the toolchain wasn't available in the development environment.

## How to verify

```bash
# Build & run baseline tests (still passing the same 9 / failing the
# same pre-existing 8 as upstream `dev` HEAD).
npm install
npm run build
npm test

# Run the new improvements integration test.
npx ts-node test/improvements-test.ts

# Run a broker and exercise each client against it.
node dist/lm-start-server.js &
LMX_HTTP_PORT=6971 node dist/lm-start-server.js &   # HTTP front-end too
( cd clients/rust   && cargo run --quiet --example smoke )
( cd clients/python && PYTHONPATH=src python3 -m live_mutex_client.smoke )
( cd clients/go     && go run ./cmd/smoke )
```

## What this branch does NOT touch

- `broker.ts` (the older non-canonical broker) is untouched. The
  improvements all live in `broker-1.ts`, which is what
  `lm-start-server.ts` instantiates and what the production CLI binary
  uses. A follow-up PR can collapse `broker.ts` into `broker-1.ts` once
  consumers are migrated.
- The legacy `lock-received` / re-election timeout path is preserved
  unchanged so existing JS clients keep working.
- RW locks (`beginRead`, `endRead`, `register-write-flag-check`, …)
  still use the same code path — they just inherit the new fencing
  tokens and centralised TTL eviction for free.
- The Java/Dart smoke tests don't run automatically; the toolchains
  weren't on the dev machine.
