'use strict';


import {routineEnter, isOtelEnabled, setOtelEnabled} from './routine';

/// Shared admin token used to gate `/admin/*` endpoints. Defaults to
/// the literal string the user explicitly chose; operators can
/// override via the `LMX_ADMIN_TOKEN` env var without rebuilding.
/// Compared against the inbound `x-admin-token` header (or the
/// `Authorization: Bearer …` header) on every admin request.
function adminToken(): string {
    const env = process.env.LMX_ADMIN_TOKEN;
    return env && env.trim() ? env.trim() : 'all-dogs-go-to-heaven';
}
/**
 * Optional HTTP front-end for live-mutex.
 *
 * Mounts on a separate port (`LMX_HTTP_PORT`, default 6971) and speaks
 * a stateless JSON protocol to callers that don't want a long-lived
 * TCP connection — Lambda functions, edge workers, smoke tests, the
 * status page itself, etc.
 *
 * Implementation note (in-process bridge)
 * ---------------------------------------
 *
 * The HTTP server runs in the same Node.js process as the broker, so
 * every HTTP request is translated to a **direct in-memory call** on
 * the broker via `InProcessBridge` — no TCP loopback, no fresh
 * sockets, no version handshake. The bridge owns one virtual socket
 * registered with the broker the same way a real connection would be,
 * which gives us identical ownership semantics: when the HTTP server
 * stops, every hold acquired through the HTTP layer is released by
 * the broker's regular `cleanupConnection` path.
 *
 * `/healthz`, `/metrics`, `/v1/stats`, and the status page all answer
 * directly from the broker handle (no bridge round-trip) for the
 * lowest possible latency on monitoring traffic.
 */

import * as http from 'http';
import {URL} from 'url';
import {Broker1} from './broker-1';
import {InProcessBridge} from './in-process-bridge';

export interface LMXHttpServerOpts {
    /// Port to listen on. Defaults to `LMX_HTTP_PORT` env or 6971.
    port?: number;
    /// Bind address. Defaults to '0.0.0.0' so the status page is reachable
    /// from sidecars / loadbalancers.
    host?: string;
    /// Maximum body bytes accepted on any POST. Hard cap; protects the
    /// broker from a runaway client. Default 64 KiB.
    maxBodyBytes?: number;
    /// Wall-clock timeout (ms) applied to every incoming request before
    /// we close the socket. Default 30s. Long-poll requests use their own
    /// caller-supplied `wait` timeout (capped by this value).
    requestTimeoutMs?: number;
    /// If true, `/` and `/status` render the human-friendly HTML status
    /// page; if false, those endpoints return JSON. Default true.
    enableHtmlStatus?: boolean;
}

export class LMXHttpServer {
    private server: http.Server | null = null;
    private bridge: InProcessBridge | null = null;
    readonly broker: Broker1;
    readonly opts: Required<LMXHttpServerOpts>;

    constructor(broker: Broker1, opts?: LMXHttpServerOpts) {
        const routineId = 'ddl-routine-l93SmiI4835db28aNq';
        routineEnter(routineId, "LMXHttpServer.constructor");
        this.broker = broker;
        this.opts = {
            port: opts?.port ?? (Number.parseInt(process.env.LMX_HTTP_PORT || '', 10) || 6971),
            host: opts?.host ?? '0.0.0.0',
            maxBodyBytes: opts?.maxBodyBytes ?? 64 * 1024,
            requestTimeoutMs: opts?.requestTimeoutMs ?? 30_000,
            enableHtmlStatus: opts?.enableHtmlStatus ?? true
        };
    }

    /// Bind the listener and wire up the in-process bridge. Idempotent.
    async start(): Promise<void> {
        const routineId = 'ddl-routine-pANjd-iYiExsCEkbVU';
        routineEnter(routineId, "LMXHttpServer.start");
        if (this.server) return;

        // Wire the bridge synchronously — no broker round-trip, no
        // sockets. The bridge survives until `stop()` and owns every
        // HTTP-acquired hold for the lifetime of the HTTP server.
        this.bridge = new InProcessBridge(this.broker, {
            defaultTimeoutMs: this.opts.requestTimeoutMs
        });

        const server = http.createServer((req, res) => {
            req.setTimeout(this.opts.requestTimeoutMs, () => {
                if (!res.headersSent) {
                    res.writeHead(408, {'Content-Type': 'text/plain'});
                    res.end('Request timed out.\n');
                }
                req.destroy();
            });

            this.handle(req, res).catch(err => {
                if (!res.headersSent) {
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: String(err && err.message || err)}));
                } else {
                    res.end();
                }
            });
        });

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(this.opts.port, this.opts.host, () => {
                server.removeListener('error', reject);
                resolve();
            });
        });

        this.server = server;
    }

    /// Stop listening. The bridge is shut down (releasing every hold
    /// it owns) and the HTTP listener is closed.
    async stop(): Promise<void> {
        const routineId = 'ddl-routine-Wj94ksWHOn7fhLeqyb';
        routineEnter(routineId, "LMXHttpServer.stop");
        if (this.server) {
            await new Promise<void>(r => this.server!.close(() => r()));
            this.server = null;
        }
        if (this.bridge) {
            this.bridge.shutdown();
            this.bridge = null;
        }
    }

    private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const routineId = 'ddl-routine-FmDaZZrVus-rpkXE8H';
        routineEnter(routineId, "LMXHttpServer.handle");
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const path = url.pathname;
        const method = req.method || 'GET';

        // Cheap routes — answered directly off the broker handle, no
        // bridge round-trip, no allocation beyond the response.
        if (method === 'GET' && (path === '/healthz' || path === '/health')) {
            return this.respondJson(res, 200, {ok: true, isOpen: this.broker.isOpen});
        }
        if (method === 'GET' && path === '/metrics') {
            res.writeHead(200, {'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'});
            return void res.end(this.broker.renderPrometheus());
        }
        if (method === 'GET' && (path === '/' || path === '/status')) {
            if (this.opts.enableHtmlStatus) {
                res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
                return void res.end(renderStatusHtml(this.broker));
            }
            return this.respondJson(res, 200, this.broker.buildStatsSnapshot());
        }
        if (method === 'GET' && path === '/v1/stats') {
            return this.respondJson(res, 200, this.broker.buildStatsSnapshot());
        }

        // Lock-flow routes — every one is a single in-memory call into
        // the broker via the bridge. No TCP loopback.
        if (method === 'POST' && path === '/v1/lock') {
            const body = await this.readJsonBody(req, res);
            if (!body) return;
            return this.handleLock(body, res);
        }
        if (method === 'POST' && path === '/v1/unlock') {
            const body = await this.readJsonBody(req, res);
            if (!body) return;
            return this.handleUnlock(body, res);
        }
        if (method === 'POST' && path === '/v1/acquire-many') {
            const body = await this.readJsonBody(req, res);
            if (!body) return;
            return this.handleAcquireMany(body, res);
        }
        if (method === 'POST' && path === '/v1/release-many') {
            const body = await this.readJsonBody(req, res);
            if (!body) return;
            return this.handleReleaseMany(body, res);
        }

        // Admin surface — runtime OTel kill-switch. Authenticated by a
        // simple shared-secret header (`x-admin-token`) so an operator
        // can flip the flag without redeploying. The default token is
        // the literal value baked in by request; override via the
        // `LMX_ADMIN_TOKEN` env var in production.
        if (path === '/admin/otel') {
            if (!this.checkAdminAuth(req, res)) return;
            if (method === 'GET') {
                return this.respondJson(res, 200, {enabled: isOtelEnabled()});
            }
            if (method === 'POST') {
                const body = await this.readJsonBody(req, res);
                if (!body) return;
                if (typeof body.enabled !== 'boolean') {
                    return this.respondJson(res, 400, {
                        error: '`enabled` is required and must be a boolean.',
                    });
                }
                const previous = setOtelEnabled(body.enabled);
                return this.respondJson(res, 200, {
                    previous,
                    enabled: isOtelEnabled(),
                });
            }
            return this.respondJson(res, 405, {
                error: `${method} not allowed on /admin/otel; use GET or POST.`,
            });
        }

        return this.respondJson(res, 404, {error: `No route for ${method} ${path}.`});
    }

    /// Validate the admin shared-secret on inbound requests to
    /// `/admin/*`. Accepts either of:
    ///
    ///   - `x-admin-token: <token>`
    ///   - `authorization: Bearer <token>`
    ///
    /// Returns `true` when the request is authorized; otherwise sends a
    /// 401 response and returns `false`.
    private checkAdminAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean {
        const routineId = 'ddl-routine-checkAdminAuth-Up7';
        routineEnter(routineId, "LMXHttpServer.checkAdminAuth");
        const expected = adminToken();
        const headerToken = (req.headers['x-admin-token'] || '').toString().trim();
        const authHeader = (req.headers['authorization'] || '').toString().trim();
        const bearerToken = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() || '';
        if (headerToken === expected || bearerToken === expected) {
            return true;
        }
        this.respondJson(res, 401, {
            error: 'admin endpoint requires `x-admin-token` (or `Authorization: Bearer ...`).',
        });
        return false;
    }

    private async handleLock(body: any, res: http.ServerResponse): Promise<void> {
        const routineId = 'ddl-routine-VYk6ktus9U945099ys';
        routineEnter(routineId, "LMXHttpServer.handleLock");
        const key = typeof body.key === 'string' ? body.key : null;
        if (!key) {
            return this.respondJson(res, 400, {error: '`key` is required and must be a string.'});
        }
        const reply = await this.bridge!.lock({
            key,
            ttl: Number.isInteger(body.ttl) ? body.ttl : null,
            max: Number.isInteger(body.max) ? body.max : undefined,
        });
        // The broker's reply shape matches the TCP wire frame. Map
        // synchronously-rejected requests (validation errors, e.g.
        // `max:0`) to HTTP 400 so misconfigured callers don't get a
        // silent 200-with-acquired:false.
        if (reply.acquired === false && typeof reply.error === 'string') {
            return this.respondJson(res, 400, {
                acquired: false,
                key,
                error: reply.error,
            });
        }
        return this.respondJson(res, 200, {
            acquired: !!reply.acquired,
            key,
            // The bridge's request uuid IS the lock-holder uuid; the
            // broker doesn't mint a separate one for single-key holds.
            lockUuid: reply.acquired ? reply._bridgeRequestUuid : undefined,
            fencingToken: reply.fencingToken,
            lockRequestCount: reply.lockRequestCount,
        });
    }

    private async handleUnlock(body: any, res: http.ServerResponse): Promise<void> {
        const routineId = 'ddl-routine-V5IkKgT3qa7_ef2Zp4';
        routineEnter(routineId, "LMXHttpServer.handleUnlock");
        const key = typeof body.key === 'string' ? body.key : null;
        if (!key) {
            return this.respondJson(res, 400, {error: '`key` is required and must be a string.'});
        }
        const lockUuid = typeof body.lockUuid === 'string' ? body.lockUuid : null;
        const force = body.force === true;
        const reply = await this.bridge!.unlock({key, lockUuid, force});
        if (reply.unlocked !== true && typeof reply.error === 'string') {
            return this.respondJson(res, 400, {
                released: false,
                key,
                error: reply.error,
            });
        }
        return this.respondJson(res, 200, {
            released: reply.unlocked === true,
            key,
            lockRequestCount: reply.lockRequestCount,
        });
    }

    private async handleAcquireMany(body: any, res: http.ServerResponse): Promise<void> {
        const routineId = 'ddl-routine-V97aST2cln2_O90HcB';
        routineEnter(routineId, "LMXHttpServer.handleAcquireMany");
        const keys = Array.isArray(body.keys) ? body.keys : null;
        if (!keys || keys.length === 0) {
            return this.respondJson(res, 400, {error: '`keys` must be a non-empty array of strings.'});
        }
        const ttl = Number.isInteger(body.ttl) ? body.ttl : null;
        const reply = await this.bridge!.acquireMany(keys, ttl);
        const status = reply.acquired ? 200 : 409;
        return this.respondJson(res, status, {
            acquired: !!reply.acquired,
            keys: reply.keys,
            lockUuid: reply.lockUuid,
            fencingTokens: reply.fencingTokens,
            contendedKey: reply.contendedKey,
            error: reply.error,
        });
    }

    private async handleReleaseMany(body: any, res: http.ServerResponse): Promise<void> {
        const routineId = 'ddl-routine-1p-jnSJaXx5hkYSA67';
        routineEnter(routineId, "LMXHttpServer.handleReleaseMany");
        const lockUuid = typeof body.lockUuid === 'string' ? body.lockUuid : null;
        if (!lockUuid) {
            return this.respondJson(res, 400, {error: '`lockUuid` is required.'});
        }
        const reply = await this.bridge!.releaseMany(lockUuid);
        return this.respondJson(res, reply.released ? 200 : 404, {
            released: !!reply.released,
            lockUuid: reply.lockUuid,
            keys: reply.keys,
            error: reply.error,
        });
    }

    private async readJsonBody(req: http.IncomingMessage, res: http.ServerResponse): Promise<any> {
        const routineId = 'ddl-routine-8TpjYKo2T6X9fDqXkw';
        routineEnter(routineId, "LMXHttpServer.readJsonBody");
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of req) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            total += buf.length;
            if (total > this.opts.maxBodyBytes) {
                this.respondJson(res, 413, {error: `Body exceeds ${this.opts.maxBodyBytes} bytes.`});
                return null;
            }
            chunks.push(buf);
        }
        const text = Buffer.concat(chunks as unknown as Uint8Array[]).toString('utf8');
        if (text.length === 0) return {};
        try {
            return JSON.parse(text);
        } catch (err) {
            this.respondJson(res, 400, {error: 'Body must be valid JSON.'});
            return null;
        }
    }

    private respondJson(res: http.ServerResponse, status: number, body: any): void {
        const routineId = 'ddl-routine-Is4S-zamAoeJ10AWpS';
        routineEnter(routineId, "LMXHttpServer.respondJson");
        if (res.headersSent) return;
        res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify(body));
    }
}

/**
 * Render the broker state as an HTML status page. Mirrors the layout
 * of `dd-rust-network-mutex`'s status page so operators see the same
 * thing across runtimes; only the data source differs.
 *
 * IMPORTANT: every dynamic value goes through `esc()` to prevent XSS
 * via crafted lock keys. Keys are user-supplied data and should never
 * be interpolated raw.
 */
function renderStatusHtml(broker: Broker1): string {
    const routineId = 'ddl-routine-mEk9Q8wvjgTX9zsuz9';
    routineEnter(routineId, "renderStatusHtml");
    const s = broker.buildStatsSnapshot();
    const startedIso = new Date(s.startedAt).toISOString();
    const memMb = (s.memoryUsage.rss / (1024 * 1024)).toFixed(1);
    const heapMb = (s.memoryUsage.heapUsed / (1024 * 1024)).toFixed(1);

    const topKeysRows = s.topKeys.length === 0
        ? '<tr><td colspan="5" class="empty">No active keys.</td></tr>'
        : s.topKeys.map(k => `
            <tr>
              <td><code>${esc(k.key)}</code></td>
              <td>${k.holders}</td>
              <td>${k.waiters}</td>
              <td>${k.max}</td>
              <td>${k.fencingToken}</td>
            </tr>
          `).join('');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>live-mutex broker status</title>
<meta http-equiv="refresh" content="5" />
<style>
  :root { --bg: #fff; --fg: #111; --muted: #666; --border: #ddd; --accent: #0a64c8; --warn: #d94a00; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #111; --fg: #eee; --muted: #888; --border: #333; --accent: #5fa8ff; --warn: #ffb168; }
  }
  body { background: var(--bg); color: var(--fg); font: 14px/1.5 -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .sub { color: var(--muted); font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 20px 0; }
  .card { border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; }
  .card .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  .card .value { font-size: 24px; font-weight: 600; margin-top: 2px; }
  .card.warn .value { color: var(--warn); }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { border-bottom: 1px solid var(--border); padding: 6px 8px; text-align: left; }
  th { color: var(--muted); font-weight: 500; }
  td.empty { color: var(--muted); text-align: center; padding: 16px; }
  code { background: rgba(127,127,127,0.15); padding: 1px 5px; border-radius: 3px; }
  footer { margin-top: 24px; color: var(--muted); font-size: 12px; }
  a { color: var(--accent); }
</style>
</head>
<body>
<h1>live-mutex broker</h1>
<div class="sub">started ${esc(startedIso)} · pid ${s.pid} · uptime ${Math.round(s.uptime)}s</div>

<div class="grid">
  <div class="card"><div class="label">Connected clients</div><div class="value">${s.connectedClients}</div></div>
  <div class="card"><div class="label">Keys</div><div class="value">${s.totalLocks}</div></div>
  <div class="card"><div class="label">Holders</div><div class="value">${s.totalHolders}</div></div>
  <div class="card"><div class="label">Waiters</div><div class="value">${s.pendingRequests}</div></div>
  <div class="card"><div class="label">Pending TTL deadlines</div><div class="value">${s.pendingDeadlines}</div></div>
  <div class="card"><div class="label">TTL evictions (total)</div><div class="value">${s.ttlEvictionsTotal}</div></div>
  <div class="card${s.concurrencyCapClampsTotal > 0 ? ' warn' : ''}"><div class="label">Concurrency-cap clamps</div><div class="value">${s.concurrencyCapClampsTotal}</div></div>
  <div class="card"><div class="label">Composite locks held</div><div class="value">${s.compositeLocksHeld}</div></div>
  <div class="card"><div class="label">RSS / heap</div><div class="value">${memMb} / ${heapMb} MB</div></div>
  <div class="card"><div class="label">Sweeper interval</div><div class="value">${s.ttlSweepIntervalMs} ms</div></div>
</div>

<h2 style="margin-top: 28px; font-size: 16px;">Top contended keys</h2>
<table>
  <thead>
    <tr><th>Key</th><th>Holders</th><th>Waiters</th><th>Max</th><th>Fencing token</th></tr>
  </thead>
  <tbody>
    ${topKeysRows}
  </tbody>
</table>

<footer>
  <a href="/v1/stats">JSON</a> · <a href="/metrics">Prometheus</a> · <a href="/healthz">Health</a> · auto-refresh 5s
</footer>
</body>
</html>`;
}

function esc(s: any): string {
    const routineId = 'ddl-routine-qeSInxza653bArA8wU';
    routineEnter(routineId, "esc");
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export default LMXHttpServer;
