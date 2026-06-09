# live-mutex clients

Cross-runtime clients for the `live-mutex` broker. The canonical client is the
library itself (`src/client.ts` — the published npm `live-mutex` package); the
folders here are additional-language clients and seeds that speak the same
JSON-over-TCP wire protocol exposed by the fencing-token-aware `Broker1`
(`src/broker-1.ts`).

| Language    | Path           | Status        | Smoke command                              |
|-------------|----------------|---------------|--------------------------------------------|
| Shell       | `shell/`       | full client   | `./clients/shell/smoke.sh`                 |
| PowerShell  | `powershell/`  | full client   | `pwsh ./clients/powershell/smoke.ps1`      |
| F#          | `fsharp/`      | seed          | see `fsharp/README.md`                      |
| Java        | `java/`        | seed          | —                                          |
| Python 3    | `python3/`     | seed          | —                                          |

The `shell/` (bash/zsh/sh) and `powershell/` clients are dependency-free working
clients: the shell one uses bash's built-in `/dev/tcp` (no `nc`/`python`/`jq`),
and the PowerShell one uses `System.Net.Sockets.TcpClient`. Both keep the wire
`type` values in named constants rather than inline magic strings — the
structural fix this broker's `if (data.type === '…')` chains lack.

> The `fsharp/`, `java/`, and `python3/` seeds were relocated here from `lib/`
> so every client lives under `clients/`.

## Wire protocol crib (Broker1)

NDJSON over TCP (`TCP_NODELAY`), one JSON object per line. Every request carries
a `uuid` the broker echoes on the reply, so one connection multiplexes many
in-flight requests.

```
# handshake (fire-and-forget; broker only replies on version-mismatch)
client → {type:"version", value:"0.2.27"}

# exclusive / semaphore lock — handle for a single key is the request uuid
client → {type:"lock", uuid, key, pid, keepLocksAfterDeath:false, ttl:<ms|null>, max?}
broker → {type:"lock", uuid, key, acquired:true,  fencingToken, lockRequestCount}
       | {type:"lock", uuid, key, acquired:false, error}

# unlock — _uuid is the lock handle (the lock request's uuid)
client → {type:"unlock", uuid, _uuid:<lockUuid>, key, force?}
broker → {type:"unlock", uuid, key, unlocked:true,  lockRequestCount}

# atomic multi-key
client → {type:"acquire-many", uuid, keys:[…], ttl:<ms|null>}
broker → {type:"acquire-many", uuid, keys, acquired:true, lockUuid, fencingTokens:{key:token,…}}
client → {type:"release-many", uuid, lockUuid}
broker → {type:"release-many", uuid, lockUuid, keys, released:true}
```

- `fencingToken` is strictly increasing per key across successive grants.
- On contention the broker does **not** reply immediately for a single-key
  `lock`; it enqueues the waiter and sends `acquired:true` only on promotion.
- `acquire-many` is all-or-nothing and acquires member keys in sorted order, so
  concurrent multi-key requests cannot deadlock.

## Smoke tests

Start a `Broker1` (defaults to port 6970), then run a client smoke:

```bash
# start a broker (build dist first with the repo's build, or use ts-node)
node -e "const {Broker1}=require('./dist/main'); new Broker1({port:6970,host:'127.0.0.1'}).ensure().then(()=>console.log('up'))"

# then, in another terminal
./clients/shell/smoke.sh
pwsh ./clients/powershell/smoke.ps1   # if PowerShell is installed
```

Override the endpoint with `LMX_HOST` / `LMX_PORT`.
