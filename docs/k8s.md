# Running `live-mutex` on Kubernetes

This doc walks through deploying the `live-mutex` broker as a
cluster-internal locking service. The recipe below is the one we run
in production: one replica, a ClusterIP `Service` exposing both the
TCP wire protocol and the optional HTTP/Prometheus front-end, an
`LMX_AUTH_TOKEN` sourced from a Kubernetes `Secret`, and a
`Recreate` strategy because all lock state lives in the broker's
process memory.

If you've never run a networked mutex broker before, please read
[the readme](../readme.md) first — especially the
"Things to keep in mind" list, which explains why this is a
single-replica service by design.

## Topology at a glance

```
+----------------------+         TCP :6970 (newline-JSON wire)
|                      |  <----- HTTP :6971 (status, /v1/*, /metrics)
|  live-mutex pod      |
|  - Broker1 (Node 22) |
|  - in-process locks  |
|                      |
+----------+-----------+
           ^
           | ClusterIP
           |
+----------+-----------+
|  Service             |
|  live-mutex.<ns>:6970|
|  live-mutex.<ns>:6971|
+----------+-----------+
           ^
           | (cluster-internal callers)
           |
   [your service A]   [your service B]   [Lambda → /v1/lock]
```

Single replica is the supported posture. See
[Why single-replica](#why-single-replica) below for the rationale.

## Container image

There are two realistic paths for getting a broker process onto your
nodes:

### 1. Public image on Docker Hub (quickest)

```bash
docker pull oresoftware/live-mutex-broker:latest
```

This is what the [getting-started-with-docker](./getting-started-with-docker.md)
guide uses. The image runs `node dist/lm-start-server.js` and listens on
TCP `:6970`. Note that the bundled `Dockerfile` in this repo is several
Node majors behind (`node:12.3.1-alpine`); for a production deploy on
Node 22 you usually want option 2 below or to roll your own image.

### 2. Build at pod start from a checkout (what we run)

Mount this repo (or the cluster's checkout of it) at a host path,
let the pod run `npm ci && npm run build` at boot, then `exec node
dist/lm-start-server.js`. This is the pattern in the deployment
manifest below. Cold-start adds 10-30 s for the install + tsc, which
is acceptable for an internal broker that restarts rarely. The
benefit is that you stay on a current Node base image
(`node:22-bookworm-slim`) without maintaining a separate image
pipeline for the broker.

If you'd rather have a published-image flow, build your own
multi-stage image:

```dockerfile
# build stage
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --omit=dev

# runtime stage
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
USER node
EXPOSE 6970 6971
CMD ["node", "dist/lm-start-server.js"]
```

## Deployment manifest

This is the build-at-pod-start variant, tuned for `Broker1` with the
HTTP front-end enabled:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: live-mutex
  namespace: default
  labels:
    app: live-mutex
spec:
  # Single replica. All lock state lives in process memory; running
  # two pods would split your namespace into two independent locking
  # universes (which is almost certainly not what you want).
  replicas: 1
  strategy:
    # Recreate, not RollingUpdate. A rolling update would spin up a
    # second pod that holds different lock state from the old one,
    # which violates mutual exclusion during the rollover window.
    type: Recreate
  selector:
    matchLabels:
      app: live-mutex
  template:
    metadata:
      labels:
        app: live-mutex
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 20
      containers:
        - name: live-mutex
          image: docker.io/library/node:22-bookworm-slim
          imagePullPolicy: IfNotPresent
          command:
            - /bin/bash
            - -lc
          args:
            - |
              set -euo pipefail
              cd /opt/live-mutex
              # `npm ci` reproduces an exact build from package-lock.json;
              # `--ignore-scripts` keeps untrusted pre/post-install hooks
              # from running inside the cluster.
              npm ci --ignore-scripts
              npm run build
              # Surface the running version so a `kubectl logs` tells
              # us *which* commit landed on this pod.
              echo "[live-mutex] HEAD=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
              # `live_mutex_host` / `live_mutex_port` are the legacy env
              # conventions the broker honors. `LMX_HTTP_PORT` enables
              # the HTTP front-end with /healthz, /v1/* (incl. multi-
              # key /v1/acquire-many), Prometheus /metrics, and the
              # auto-refresh status page on /.
              exec env \
                live_mutex_host=0.0.0.0 \
                live_mutex_port=6970 \
                LMX_HTTP_PORT=6971 \
                LMX_HTTP_HOST=0.0.0.0 \
                node dist/lm-start-server.js
          securityContext:
            allowPrivilegeEscalation: false
            seccompProfile:
              type: RuntimeDefault
            capabilities:
              drop:
                - ALL
          env:
            # Optional admin token for the runtime OTel kill-switch
            # at /admin/otel. Sourced from the same Secret as the
            # auth token below, so it rotates together.
            - name: LMX_ADMIN_TOKEN
              valueFrom:
                secretKeyRef:
                  name: live-mutex-secrets
                  key: LMX_ADMIN_TOKEN
                  optional: true
            # OTLP exporter endpoint (optional). When set, the broker
            # emits spans + events to the configured collector. When
            # unset, the broker stays a quiet single-process service.
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: http://otel-collector.observability.svc.cluster.local:4317
            - name: OTEL_SERVICE_NAME
              value: live-mutex
          ports:
            - name: lmx-tcp
              containerPort: 6970
            - name: http
              containerPort: 6971
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 768Mi
          # During the build phase the HTTP listener isn't up yet, so
          # we use a TCP probe initially and let the HTTP front-end
          # come up whenever it can. failureThreshold: 60 * 5s = 5m,
          # comfortably more than the worst-case `npm ci` we've seen.
          startupProbe:
            tcpSocket:
              port: lmx-tcp
            periodSeconds: 5
            failureThreshold: 60
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          volumeMounts:
            - name: source
              mountPath: /opt/live-mutex
      volumes:
        # Replace this hostPath with your own mount strategy:
        #   - hostPath  (each node ships the checkout via cloud-init)
        #   - emptyDir + initContainer that runs `git clone`
        #   - PersistentVolumeClaim populated by your CD pipeline
        - name: source
          hostPath:
            path: /opt/live-mutex
            type: Directory
```

If you went with a published image (option 1 or your own), drop the
`command` / `args` / `volumeMounts` / `volumes` blocks and let the
image's `CMD` start the broker. The probe block stays the same.

## Service manifest

```yaml
apiVersion: v1
kind: Service
metadata:
  name: live-mutex
  namespace: default
  labels:
    app: live-mutex
  annotations:
    # Standard Prometheus scrape annotations. The HTTP listener
    # exposes /metrics in plain Prometheus exposition format.
    prometheus.io/scrape: 'true'
    prometheus.io/port: '6971'
    prometheus.io/path: /metrics
spec:
  type: ClusterIP
  selector:
    app: live-mutex
  ports:
    - name: lmx-tcp
      port: 6970
      targetPort: lmx-tcp
    - name: http
      port: 6971
      targetPort: http
```

Cluster-internal callers reach the broker at:

- `tcp://live-mutex.default.svc.cluster.local:6970` for the wire
  protocol (use `Client` / `LMXClient` / `RWLockClient` from the
  npm package).
- `http://live-mutex.default.svc.cluster.local:6971/v1/*` for
  serverless-style callers (Lambda, Workers) that can't hold a
  long-lived TCP connection. The HTTP API surface includes
  `/v1/lock`, `/v1/unlock`, `/v1/acquire-many`, `/v1/release-many`,
  and the auto-refresh status page on `/`.

## Authentication

The broker has two relevant tokens:

- `LMX_ADMIN_TOKEN` — required to flip the runtime OTel kill-switch
  via `POST /admin/otel`. Send as `Authorization: Bearer <token>`.
- *(client auth is on the roadmap; for now, lock the broker's TCP/HTTP
  ports behind a `NetworkPolicy` — see below — and expose only over
  the cluster's mesh.)*

Create the secret with whatever rotation pipeline you already use
(External Secrets, sealed-secrets, sops, ArgoCD vault plugin, etc.):

```bash
kubectl create secret generic live-mutex-secrets \
  --from-literal=LMX_ADMIN_TOKEN="$(openssl rand -hex 32)" \
  --namespace default
```

Pair this with a `NetworkPolicy` that only allows the namespaces
that need locking to talk to the broker on `lmx-tcp` / `http`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: live-mutex-allow
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: live-mutex
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector: {}            # any pod in the same namespace
        - namespaceSelector:
            matchLabels:
              role: locking-client    # other namespaces opt in
      ports:
        - { protocol: TCP, port: 6970 }
        - { protocol: TCP, port: 6971 }
```

## Scaling, durability, and HA

### Why single-replica

All lock state lives in `Broker1` process memory: holders, queues,
fencing-token counters, deadline tracking, and the partial-grant
tracker for `acquireMany`. Two replicas would each have their own
state, so:

- A client connecting to replica A and a client connecting to
  replica B would never see each other's locks (split brain).
- Service-level mutual exclusion would silently degrade, which is
  the worst possible failure mode for a locking service.

Therefore: 1 replica, `Recreate` strategy, no `HorizontalPodAutoscaler`.

### Pod restarts and lock loss

A pod restart drops all in-memory state. Holders that were holding
locks at the moment of restart get a `connection reset` on their
TCP socket; they are responsible for re-acquiring on reconnect, and
the broker will mint **new** fencing tokens. Use TTLs (default
4 s, configurable per-acquire) so callers that don't reconnect
promptly free up their slots naturally.

If you need the broker to survive its own crash, the right answer
is one of:

1. **Active-passive HA** behind a single-leader gate (e.g. a
   Postgres advisory lock or a Kubernetes `Lease`). Only the leader
   serves clients; the passive replica picks up if the leader's
   `Lease` lapses. Fencing tokens reset on failover, so callers
   must be prepared to see the counter restart.
2. **Run multiple brokers, partition by key.** If you can route
   distinct key prefixes to distinct brokers (e.g. by hashing the
   key client-side), each broker owns a subset of the namespace
   and a single broker's failure only affects its keys. This works
   well in practice and avoids the operational complexity of HA.

In our experience the single-replica + `Recreate` posture is
sufficient for production workloads; the broker restarts in well
under a second once the `npm ci` cache is warm.

### Resource sizing

The reference resource block above (`50m`/`128Mi` requests,
`500m`/`768Mi` limits) handles a steady-state workload of a few
thousand acquires per second on a hot key plus tens of thousands of
cold-key holders. The broker is single-threaded (Node.js event
loop), so giving it more than 1 vCPU rarely buys throughput — raise
the memory limit if you observe the resident set growing past
`max-old-space-size`.

The most useful Prometheus series for sizing decisions are the
`live_mutex_*` counters and gauges exposed at
`http://…:6971/metrics`. Watch in particular:

- `live_mutex_clients` — connected clients.
- `live_mutex_held_locks` — current in-flight grants.
- `live_mutex_queue_depth` — sum of waiters across all keys.
- `live_mutex_ttl_evictions_total` — counter of TTL-driven force
  releases. Sustained growth means callers are dying without
  releasing.

## Observability

Logs go to stdout in `bunion`-style structured JSON
(`bunion_producer_level=WARN` is the production setting). Routine
IDs (`ddl-routine-*`) are static literals in source, so a
`kubectl logs … | rg ddl-routine-XYZ` lands you at the exact
function in this repo.

If `OTEL_EXPORTER_OTLP_ENDPOINT` is set in the broker's env, the
process initialises an OTLP exporter at startup (see
`src/routine.ts → initOtel()`). The runtime kill-switch at
`POST /admin/otel` lets you flip OTel emission on/off without a
restart:

```bash
# Disable OTel emission at runtime:
curl -X POST \
  -H "Authorization: Bearer $LMX_ADMIN_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"enabled":false}' \
  http://live-mutex.default.svc.cluster.local:6971/admin/otel
```

## Operator runbook

### Status page

`GET /` (and `GET /status`) on `:6971` serves a server-rendered HTML
operator page: connected clients, holders by key, queued waiters,
fencing-token watermarks, and the embedded `/metrics` exposition.
Auto-refreshes every 5 s. No JS, no external assets, friendly to
`curl | rg`.

### Forcing a restart

If you suspect the in-memory state has wedged (e.g. a holder is
stuck on a key the broker never frees because the holder is still
TCP-connected and answering keepalives), you can:

```bash
kubectl rollout restart deployment/live-mutex
```

`Recreate` strategy means the old pod terminates first, then the
new one starts. Plan a brief acquire-error window when you do
this — clients with retry logic will re-acquire on reconnect.

### Local smoke test

To sanity-check a freshly applied manifest from a developer
workstation:

```bash
kubectl port-forward svc/live-mutex 16970:6970 16971:6971 &

# HTTP healthcheck
curl -s http://127.0.0.1:16971/healthz

# Acquire + release a real single-key lock
LOCK_UUID=$(curl -s http://127.0.0.1:16971/v1/lock \
  -H 'content-type: application/json' \
  -d '{"key":"smoke","ttlMs":2000}' | jq -r .lockUuid)

curl -s http://127.0.0.1:16971/v1/unlock \
  -H 'content-type: application/json' \
  -d "{\"key\":\"smoke\",\"lockUuid\":\"$LOCK_UUID\"}"

# Acquire + release a multi-key lock (atomic):
LOCK_UUID=$(curl -s http://127.0.0.1:16971/v1/acquire-many \
  -H 'content-type: application/json' \
  -d '{"keys":["users","orders"],"ttlMs":2000}' | jq -r .lockUuid)

curl -s http://127.0.0.1:16971/v1/release-many \
  -H 'content-type: application/json' \
  -d "{\"lockUuid\":\"$LOCK_UUID\"}"
```

If all three calls return `200 OK` with the expected
`acquired: true` / `unlocked: true` shape, the broker is healthy
and the `Broker1` features (fencing tokens, multi-key locks) are
wired through.

## Multi-cluster / multi-region

The broker is **regional by design**: it serves whatever cluster it
runs in. To coordinate across clusters or regions, run one broker
per cluster and let your application use the local one — distributed
locks across regions need a different tool (Postgres advisory locks,
etcd, ZooKeeper, Redis Redlock with all of its caveats). A single
broker stretched across regions would have RTT latencies that
defeat the purpose of having a fast in-memory locking service.

## Sibling: the Rust port

A from-scratch Rust port of this broker lives at
[`live-mutex-rs`](https://github.com/ORESoftware/live-mutex-rs). It
ships the same wire protocol (with field-naming differences — see
the upstream readme's "Relationship to upstream" section) and adds
TLS as a cargo feature, a published Docker Hub image
(`oresoftware/live-mutex-rs`), and slightly higher throughput on
hot-key workloads. The k8s recipes above translate one-to-one
(swap the image, flip the env-var prefix to `LMX_*`); see
[`live-mutex-rs/docs/k8s.md`](https://github.com/ORESoftware/live-mutex-rs/blob/dev/docs/k8s.md)
for the Rust-specific manifest.
