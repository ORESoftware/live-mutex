# live-mutex wire protocol (Broker1)

This document specifies the JSON-over-TCP protocol spoken by the
fencing-token-aware `Broker1` (`src/broker-1.ts`). It is the contract the
cross-runtime clients under `clients/` implement.

> **Note on broker variants.** The repo ships two broker classes. The legacy
> `Broker` (`src/broker.ts`) does **not** emit fencing tokens or support
> `acquire-many`. `Broker1` (`src/broker-1.ts`) adds monotonic fencing
> tokens and atomic multi-key (`acquire-many`) holds. The clients here target
> `Broker1`. When a client talks to the legacy broker, `fencingToken` is
> simply absent and clients should treat it as `0`/unknown.

## Transport

- TCP, `TCP_NODELAY` on.
- **Framing:** newline-delimited JSON (NDJSON). Exactly one JSON object per
  line, terminated by `\n`. No length prefix.
- **Multiplexing:** every request carries a `uuid`. The broker echoes that
  `uuid` on the matching reply, so one connection can carry many concurrent
  in-flight requests. Clients keep a map of `uuid -> waiter`.
- **Encoding:** UTF-8. Numbers are JSON numbers; fencing tokens can exceed
  2^53 is not expected (they are `Date.now()`-seeded counters), but clients
  should still parse them without lossy `double` round-tripping where the
  language makes that easy.

## Handshake

Immediately after connecting, the client sends:

```json
{"type":"version","value":"0.2.25"}
```

The broker only responds if the client is **strictly older** than it supports,
in which case it sends `{"type":"version-mismatch","versions":{…}}` and may
close the connection. On a compatible version there is **no reply** — the
handshake is fire-and-forget. Bumping the client version string is therefore
forward-safe.

## Requests → Replies

### Exclusive / semaphore lock

```
client → {type:"lock", uuid, key, pid, keepLocksAfterDeath:false, ttl:<ms|null>, max?}
broker → {type:"lock", uuid, key, acquired:true,  fencingToken, lockRequestCount, readersCount?}
       | {type:"lock", uuid, key, acquired:false, error}     // hard rejection (e.g. max < 1)
```

- `ttl`: lock lease in ms. `null` → broker default (`lockExpiresAfter`, ~5s).
- `max`: per-key concurrency. Omitted → mutex (`max = 1`). `max >= 2` makes the
  key a semaphore. `max < 1` is rejected.
- **Contention:** if the key is held, the broker does **not** reply
  immediately. It enqueues the waiter and sends `acquired:true` only when the
  waiter is promoted to holder. Clients block until they see `acquired:true`
  or an `acquired:false` **with** an `error`.
- `fencingToken`: strictly increasing per key across successive grants. Use it
  to fence stale lease holders at the resource being protected.
- For a single-key lock the client's **lock handle is the request `uuid`** —
  that is what you pass back as `_uuid` to unlock.

### Unlock

```
client → {type:"unlock", uuid, _uuid:<lockUuid>, key, force?}
broker → {type:"unlock", uuid, key, unlocked:true,  lockRequestCount}
       | {type:"unlock", uuid, key, unlocked:false, error}
```

- `_uuid` is the lock handle returned by the matching `lock` grant.
- `force:true` drops the current holder even if `_uuid` doesn't match; a
  targeted force against a non-existent holder is rejected with `unlocked:false`
  rather than silently wiping peers.
- Unlocks are idempotent against TTL eviction: a late unlock for a holder the
  sweeper already evicted returns `unlocked:true`.

### acquire-many (atomic multi-key)

```
client → {type:"acquire-many", uuid, keys:[…], ttl:<ms|null>}
broker → {type:"acquire-many", uuid, keys, acquired:true,  lockUuid, fencingTokens:{key:token,…}}
       | {type:"acquire-many", uuid, keys, acquired:false, contendedKey?, error?}
```

- Union semantics: the caller wants **all** keys held at once. The broker
  acquires member keys in **sorted order** to prevent deadlock between
  concurrent multi-key requests.
- All-or-nothing: if any key is contended, the broker rolls back the partial
  acquisition and re-queues the waiter; on success it registers one composite
  hold addressed by `lockUuid`.
- `fencingTokens` maps each key to its own fencing token.

### release-many

```
client → {type:"release-many", uuid, lockUuid}
broker → {type:"release-many", uuid, lockUuid, keys, released:true}
       | {type:"release-many", uuid, released:false, error}
```

- Releases a composite hold by its `lockUuid`. Releasing an unknown/already-
  released `lockUuid` returns `released:false` with an explanatory `error`.

## Invariants clients can rely on

1. **Mutual exclusion:** for `max = 1`, at most one holder per key at any time.
2. **Semaphore bound:** for `max = n`, at most `n` concurrent holders per key;
   additional requests queue FIFO-ish (subject to waiter liveness checks).
3. **Fencing monotonicity:** `fencingToken` for a key never decreases across
   successive grants, even across holder handoffs and TTL evictions.
4. **acquire-many atomicity:** either every requested key is granted (and you
   get a `fencingTokens` entry for each) or none is.
5. **Deadlock-free multi-key:** concurrent `acquire-many` calls with
   overlapping key sets cannot deadlock (sorted acquisition order).

## Features intentionally omitted by the reference clients

- RW locks (`registerRead`/`registerWrite`/`endRead`/`endWrite`).
- The legacy `lock-received` ack. The broker's centralised TTL sweeper
  reclaims holders that disconnect or never ack, so stateless callers may
  skip it.
- `ls` / `lockInfo` inspection RPCs.

These are supported by the canonical Node client (`src/client.ts`); the
minimal cross-runtime clients focus on the core lock lifecycle and the
fencing-token / acquire-many features.
