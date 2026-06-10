# live-mutex — client libraries audit (2026-06-09)

This (upstream, single-node, TypeScript) repo keeps its non-TS client libraries
under `lib/` (not `clients/`). Audit of correctness/testability:

| Language | Path | State | Verdict |
|---|---|---|---|
| F# | `lib/fsharp/` | Full project with `tests/fsharp.Tests/` | **blocked** — no `dotnet` installed; cannot run |
| Java | `lib/java/` | `.gitkeep` only | **stub** — no implementation to test |
| Python3 | `lib/python3/main.py` | Single file | **needs upstream broker** — requires the upstream `live-mutex` Node broker running; not stood up here |

**Finding:** unlike the three Rust/TS sibling repos (which have rich, tested,
multi-language `clients/` suites), this repo's `lib/` client coverage is thin:
one complete-but-unrunnable-here F# project, one empty Java placeholder, and one
broker-dependent Python script. If cross-language client parity matters for the
upstream repo, the sibling repos' `clients/` layout (per-language protocol +
client + offline protocol test + live smoke) is the model to copy.

The repo's own broker test suite (`test/@src/`, ~80 suman tests) is separate and
out of scope for a *clients* audit.
