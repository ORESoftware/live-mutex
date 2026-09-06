# live-mutex cross-runtime clients

Reference clients for the `live-mutex` broker. Each client
speaks the same JSON-over-TCP wire protocol the JS broker exposes (NDJSON;
one frame per line). They are intentionally minimal — focused on
**correctness of the new wire protocol features** rather than feature
parity with the canonical Node.js client (which also covers RW locks,
`ls`, retries, etc.).

The native TypeScript client is the library itself (`src/client.ts`), so the
list below plus TypeScript covers Dart, C++, Python, TypeScript, Go, Gleam,
Rust, Java, shell, and PowerShell.

| Language    | Path                | Acquire | Release | Fencing tokens | acquire-many | Smoke test |
|-------------|---------------------|:-------:|:-------:|:--------------:|:------------:|:----------:|
| Rust        | `clients/rust`      | ✅      | ✅      | ✅              | ✅           | `cargo run --example smoke` |
| Python 3    | `clients/python`    | ✅      | ✅      | ✅              | ✅           | `python -m live_mutex_client.smoke` |
| Shell       | `clients/shell`     | ✅      | ✅      | ✅              | —            | `./clients/shell/smoke.sh` |
| PowerShell  | `clients/powershell` | ✅     | ✅      | ✅              | —            | `pwsh ./clients/powershell/smoke.ps1` |
| Go          | `clients/go`        | ✅      | ✅      | ✅              | ✅           | `go run ./cmd/smoke` |
| Dart        | `clients/dart`      | ✅      | ✅      | ✅              | ✅           | `dart run example/smoke.dart` |
| Java 17+    | `clients/java`      | ✅      | ✅      | ✅              | ✅           | `mvn -q exec:java` |
| C++17       | `clients/cpp`       | ✅      | ✅      | ✅              | ✅           | `make run` / `make test` |
| Gleam       | `clients/gleam`     | ✅      | ✅      | ✅              | ✅           | `LIVE_MUTEX_SMOKE=1 gleam test` |
| TypeScript  | `src/client.ts`     | ✅      | ✅      | ✅              | ✅           | `npm test` |

All clients implement at minimum:

- A `connect(host, port)` that sends the version handshake (`{type:"version", value:"0.2.27"}`).
- An `acquire(key, opts)` that returns `{lockUuid, fencingToken}`.
- A `release(key, lockUuid, opts)` that returns when the broker confirms.
- An `acquireMany(keys, opts)` that returns `{lockUuid, fencingTokens}` for the union of `keys`.
- A `releaseMany(lockUuid)`.
- A correlation map keyed by request-uuid so a single connection can multiplex.

**Wire format crib sheet** (see also `clients/PROTOCOL.md` for the full
specification):

```
client → broker
  {type:"version", value:"0.2.27"}
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

The `shell` and `powershell` clients are intentionally dependency-free working
clients: the shell implementation uses bash's built-in `/dev/tcp` rather than
`nc`, `python`, or `jq`, and the PowerShell implementation uses
`System.Net.Sockets.TcpClient`. Both keep request `type` values in named
constants so protocol spelling stays centralized.

Run the broker (the fencing-token-aware `Broker1`) before running any of the
smoke tests. Most smokes default to `127.0.0.1:7970`; override with
`LMX_HOST`/`LMX_PORT`. A quick way to start `Broker1`:

```sh
node -e "const {Broker1}=require('./dist/main.js'); \
  new Broker1({port:7970,host:'127.0.0.1'}).ensure().then(()=>console.log('up'))"
```
