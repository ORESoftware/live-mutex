# Formal verification contract

This directory defines the safety obligations for `live-mutex` across Broker1, the wire protocol, external effects, and every polyglot client.

`test/formal-fencing-model-test.ts` is an executable bounded model checker. It exhaustively explores the reachable abstract state space for one canonical resource key, two clients, two distinct work identities, and four successive fencing grants. The real Broker1 integration tests connect those abstract properties to implementation behavior.

## Safety invariants

For each canonical resource key:

1. **Exclusive ownership** — at most one exclusive owner is current at a time.
2. **Strictly monotonic fencing** — every successor grant receives a token greater than every prior grant for that key.
3. **Release cannot roll authority back** — releasing a lock never resets or reuses the fencing high-watermark.
4. **Stale-writer rejection** — an external effect whose token is below the durable downstream watermark is rejected.
5. **Exact replay only** — the current token may repeat successfully only for the exact same operation/payload identity.
6. **Same-token different-work rejection** — reusing the current token for different work is rejected.
7. **Per-key scope** — composite grants preserve the token belonging to each exact resource key; tokens are not interchangeable between keys.
8. **Lossless client propagation** — every client must expose the fencing token returned by Broker1 and must not derive, round, truncate, or silently drop that authority value.

The model deliberately allows an old client to act after release/supersession. That zombie-writer transition is the core failure mode the fencing contract is designed to contain.

## Client conformance

`test/formal-client-fencing-surface-test.ts` walks every client implementation directory and requires an implementation-level fencing-token surface. This makes a newly added language fail the ordinary test suite if it omits fencing authority.

The fencing integration tests additionally exercise real sequential Broker1 grants and downstream high-watermark behavior. Together these provide an abstract safety model, a client-surface conformance gate, and an implementation refinement witness.

## Scope

This is bounded exhaustive model checking, not an unbounded theorem proof. The small token bound keeps the model fast enough for normal CI while still exploring repeated acquire/release cycles, successor owners, stale writers, exact replay, and unsafe token reuse. Changes to grant ordering, token serialization, replay semantics, multi-key behavior, or client grant types must update these checks in the same PR.
