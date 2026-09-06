# live-mutex client libraries audit (2026-07-16 merge refresh)

The earlier `lib/`-era audit found thin non-TypeScript client coverage. This
merge refresh incorporates the newer `clients/` layout plus the shell and
PowerShell clients from the local branch, so the audit target is now the
cross-runtime client tree documented in [README.md](./README.md).

| Language | Path | State | Smoke/validation |
|---|---|---|---|
| TypeScript | `src/client.ts` | canonical package client | `npm test` |
| Rust | `clients/rust` | acquire/release/fencing/acquire-many | `cargo run --example smoke` |
| Python 3 | `clients/python` | acquire/release/fencing/acquire-many | `python -m live_mutex_client.smoke` |
| Go | `clients/go` | acquire/release/fencing/acquire-many | `go run ./cmd/smoke` |
| Dart | `clients/dart` | acquire/release/fencing/acquire-many | `dart run example/smoke.dart` |
| Java 17+ | `clients/java` | acquire/release/fencing/acquire-many | `mvn -q exec:java` |
| C++17 | `clients/cpp` | acquire/release/fencing/acquire-many | `make run` / `make test` |
| Gleam | `clients/gleam` | acquire/release/fencing/acquire-many | `LIVE_MUTEX_SMOKE=1 gleam test` |
| Shell | `clients/shell` | dependency-free lock/unlock smoke | `./clients/shell/smoke.sh` |
| PowerShell | `clients/powershell` | dependency-free lock/unlock smoke | `pwsh ./clients/powershell/smoke.ps1` |

Remaining gap: the relocated F# seed exists under `clients/fsharp`, but it still
requires a .NET toolchain before it can be promoted from seed to verified client.
