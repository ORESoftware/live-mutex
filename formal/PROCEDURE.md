# Formal lock/refinement procedure

This is the Node.js peer of the bounded model used by `ORESoftware/live-mutex-rs`. The two repositories intentionally carry the same abstract lock semantics so protocol drift is visible in review.

The model proves its bounded state space exhaustively for single-holder exclusion, FIFO waiter progress, idempotent request IDs, monotonic fencing, renewal, stale release, and TTL expiry. It does not claim to prove TCP behavior, unbounded state, process scheduling, or deployment topology.

Run:

```bash
node formal/model.mjs
printf '%s\n' '{"actions":[{"kind":"acquire","client":"a","requestId":"a-1"},{"kind":"acquire","client":"b","requestId":"b-1"},{"kind":"release","client":"a","fence":1}]}' | node formal/model.mjs --json-stdin
```
