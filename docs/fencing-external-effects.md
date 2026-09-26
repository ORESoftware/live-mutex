# Fencing tokens and external effects

`Broker1` returns a fencing token with every successful lock grant. The token is authority metadata, not decoration: code that mutates a resource outside the broker must propagate it to the system that owns that resource.

## Why the mutex alone is not enough

A lease/TTL can expire while a holder is paused. A successor can then acquire the same key and make progress while the old holder later resumes. The broker cannot reach into PostgreSQL, S3, a payment API, or another service to revoke work that was already in flight.

```text
A acquires key, fence = 41
A pauses
A's lease is lost / superseded
B acquires key, fence = 42
B writes external state with fence 42
A resumes and attempts its delayed write with fence 41
```

The external boundary must reject A.

## Fence-aware datastores

For PostgreSQL-compatible databases, Redis/Valkey, or another store with an atomic compare-and-set primitive, keep a durable high-watermark per protected resource.

```text
incoming > watermark                    => advance watermark and mutate
incoming < watermark                    => reject as stale
incoming == watermark + same operation  => idempotent replay / no-op
incoming == watermark + different work  => reject token reuse
```

The comparison, watermark update, and protected mutation must be one atomic operation. A `SELECT` check followed by an unrelated `UPDATE` is not a fence because another writer can enter between them.

One useful relational shape is:

```sql
CREATE TABLE resource_fence (
  resource_key text PRIMARY KEY,
  fencing_token numeric(20, 0) NOT NULL,
  operation_id text NOT NULL,
  payload_sha256 text NOT NULL
);
```

The application transaction should lock/update the fence row and the protected business rows together.

## External APIs that do not understand fencing tokens

Some HTTP APIs cannot compare a numeric fencing token. For those calls, use the API's durable idempotency-key mechanism when it has one. Generate the operation identity before the call, persist it with the work intent/outbox, and reuse the same identity when retrying an uncertain response.

Do not create a fresh idempotency key after a timeout. That is a second operation, not a retry.

When an API supports conditional versioning as well as idempotency, send both the fencing/version condition and the stable operation identity.

## Restart and multi-broker note

A fencing token is useful only when the downstream system remembers what it has accepted. `live-mutex` currently keeps its broker lock state in process memory and is designed around a single authoritative Broker1 instance. Do not treat independent Broker1 replicas as one fencing authority unless they share a consensus/durable token source.

For workflows requiring authority across failover, use a durable/replicated lock authority (for example the Rust live-mutex Raft mode or the managed authorities in `ORESoftware/ores-locks-and-leases`) and still fence each external datastore independently.

## Client requirements

Every client language must preserve the token exactly and expose it beside the lock handle. Callers should pass the token into the protected write rather than reading it from logs or reconstructing it from time.

For multi-key grants, use the token corresponding to the exact resource key being mutated. Never collapse several per-key tokens into one arbitrary token.

## Executable contract

`test/fencing-external-effects-test.ts` obtains two real Broker1 grants for the same key, applies the newer grant to a simulated durable downstream watermark, and verifies that the delayed older grant is rejected. It also verifies that an exact retry is accepted while equal-token reuse for different work fails closed.
