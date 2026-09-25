# Durable fencing authority

`Broker1` has two intentionally different fencing modes.

## Ephemeral broker-incarnation mode

Without `LMX_FENCING_TOKEN_STATE_PATH`, the broker keeps a monotonic high-watermark for the life of the process. `LMX_FENCING_TOKEN_FLOOR` can supply a trusted restart floor, but the broker does not persist that value itself.

This mode is useful for tests, disposable brokers, or deployments where an external consensus system restores a committed floor. It must not be described as restart-durable stale-writer fencing by itself.

## Durable standalone-broker mode

Set `LMX_FENCING_TOKEN_STATE_PATH` to an absolute or relative file path on durable local storage.

Before a grant can expose a newly advanced fencing token, the hardened broker:

1. serializes the new broker-wide high-watermark as canonical decimal text;
2. writes it to a temporary file in the target directory;
3. `fsync`s that file;
4. atomically renames it onto the configured state path; and
5. advances the in-memory authority only after persistence succeeds.

A crash can consume a token without returning the grant. That gap is safe. A restarted broker must never issue a token at or below the persisted high-watermark.

The state file uses this shape:

```json
{
  "schema": "live-mutex.fencing-watermark/v1",
  "watermark": "12345"
}
```

The watermark is decimal text rather than a JSON number so the storage format never depends on binary floating-point serialization. The current broker still caps the wire token at JavaScript's exact-integer ceiling (`Number.MAX_SAFE_INTEGER`) because maintained clients exchange the token as a JSON number.

Corrupt or unsupported state fails closed during broker construction. A persistence failure during grant allocation returns `fencing_token_persistence_failed`; it must never fall back to an in-memory-only grant.

## Downstream writes still need fences

Durable broker state does not make an external side effect automatically safe. Supabase, Neon/Postgres, Redis, queues, object stores, and other downstream systems must still reject stale writers using the broker-issued fencing token, or use a stable idempotency identity when a numeric high-watermark cannot be enforced.

The safe sequence is:

`acquire -> persist/mint fence -> guarded downstream write -> release`

For a database mutation, compare/advance the downstream high-watermark in the same transaction or script as the protected write. Do not perform a separate check-then-write round trip.

## Clustered brokers

A node-local file is a single-host restart authority, not a multi-node consensus protocol. Clustered deployments should restore `LMX_FENCING_TOKEN_FLOOR` from a committed replicated authority or delegate token minting to Fiducia Cloud, Cloudflare Durable Objects, PostgreSQL, Redis with an independent monotonic authority, or another strongly consistent service.
