# live-mutex cross-runtime clients

Reference clients for the `live-mutex` broker in five languages. Each client
speaks the same JSON-over-TCP wire protocol the JS broker exposes (NDJSON;
one frame per line). They are intentionally minimal — focused on
**correctness of the new wire protocol features** rather than feature
parity with the canonical Node.js client (which also covers RW locks,
`ls`, retries, etc.).

| Language | Path                | Acquire | Release | Fencing tokens | acquire-many | Smoke test |
|----------|---------------------|:-------:|:-------:|:--------------:|:------------:|:----------:|
| Rust     | `clients/rust`      | ✅      | ✅      | ✅              | ✅           | `cargo run --example smoke` |
| Python 3 | `clients/python`    | ✅      | ✅      | ✅              | ✅           | `python -m live_mutex_client.smoke` |
| Go       | `clients/go`        | ✅      | ✅      | ✅              | ✅           | `go run ./cmd/smoke` |
| Dart     | `clients/dart`      | ✅      | ✅      | ✅              | ✅           | `dart run example/smoke.dart` |
| Java     | `clients/java`      | ✅      | ✅      | ✅              | ✅           | `mvn -q exec:java` |

All clients implement at minimum:

- A `connect(host, port)` that sends the version handshake (`{type:"version", value:"0.2.25"}`).
- An `acquire(key, opts)` that returns `{lockUuid, fencingToken}`.
- A `release(key, lockUuid, opts)` that returns when the broker confirms.
- An `acquireMany(keys, opts)` that returns `{lockUuid, fencingTokens}` for the union of `keys`.
- A `releaseMany(lockUuid)`.
- A correlation map keyed by request-uuid so a single connection can multiplex.

**Wire format crib sheet** (see also `PROTOCOL.md` in the repo root once
written):

```
client → broker
  {type:"version", value:"0.2.25"}
  {type:"lock", uuid, key, ttl?, max?, pid?}
  {type:"unlock", uuid, _uuid:<lockUuid>, key, force?}
  {type:"acquire-many", uuid, keys:[…], ttl?}
  {type:"release-many", uuid, lockUuid}

broker → client
  {type:"lock", uuid, key, acquired:bool, fencingToken?, lockRequestCount, error?}
  {type:"unlock", uuid, key, unlocked:bool, lockRequestCount, error?}
  {type:"acquire-many", uuid, keys, acquired:bool, lockUuid?, fencingTokens?, contendedKey?, error?}
  {type:"release-many", uuid, lockUuid?, keys?, released:bool, error?}
```

These clients **do not** implement RW locks or the legacy `lock-received`
ack path — the broker tolerates clients that don't ack (the centralised
TTL sweeper picks up any stragglers), so for a stateless caller the
simplified flow is sufficient.

Run the broker on `127.0.0.1:6970` (e.g. `node dist/lm-start-server.js`)
before running any of the smoke tests.
