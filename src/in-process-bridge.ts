'use strict';


import {routineEnter} from './routine';
/**
 * In-process bridge between an HTTP (or any other) caller and the
 * `Broker1` instance.
 *
 * Why this exists
 * ---------------
 *
 * The HTTP front-end and the broker run in the same Node.js process.
 * Going through `net.createServer` for that round-trip would mean:
 *   - kernel TCP queue + Nagle / quickack tuning,
 *   - a second JSON-NDJSON parse on the same machine,
 *   - opaque ownership semantics if the loopback socket flaps mid-request.
 *
 * The Rust port (`rust-network-mutex-rs/src/server.rs::http_acquire`)
 * already does the obvious thing — it calls `broker.handle_request`
 * directly via an in-memory channel. This module is the JS equivalent:
 * the HTTP server holds **one** `InProcessBridge`, and every HTTP
 * request becomes a synchronous `broker.lock(data, virtualSocket)` /
 * `broker.acquireMany(data, virtualSocket)` etc. call. No sockets, no
 * fresh connections, no version handshake, no Nagle — pure function
 * calls plus a correlation map for the reply.
 *
 * Ownership semantics
 * -------------------
 *
 * Every HTTP-acquired lock is "owned" by the bridge's single virtual
 * socket. That mirrors the previous TCP-loopback design (one shared
 * `Client` connection owned every HTTP-acquired lock) and keeps the
 * existing broker invariant: when the owning ws disappears, all its
 * locks are force-released. On `bridge.shutdown()` we tell the broker
 * to clean up that virtual socket so HTTP-acquired locks don't survive
 * a stop/restart cycle.
 *
 * The bridge is intentionally minimal: it speaks the same JSON wire
 * frames as the TCP path. That means the broker doesn't need a
 * separate code path for HTTP requests, and any future broker change
 * (new `type`, new field on a reply) flows through unchanged. We add
 * nothing the broker has to be aware of.
 */

import {EventEmitter} from 'events';
import * as UUID from 'uuid';
import {Broker1, LMXSocket} from './broker-1';

/**
 * Awaiter handle for a single in-flight in-process request. The
 * bridge reads the broker's reply (whatever frame `broker.send` emits
 * on the virtual socket), matches by `uuid`, and resolves the
 * `Promise` returned to the HTTP handler.
 */
type Pending = {
    resolve: (msg: any) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
};

/**
 * Mock `net.Socket` that the broker can hold onto as an opaque
 * connection handle. We only implement the surface the broker
 * actually touches — see the call sites in `broker-1.ts`:
 * `ws.writable`, `ws.write(buf, enc, cb)`, `ws.lmxClosed`, plus
 * the no-op `destroy` / `end` / `removeAllListeners` cleanup hooks.
 *
 * `pipe()` is implemented as a no-op identity because the broker's
 * connection handler calls `ws.pipe(createParser())` — but we never
 * route the bridge's virtual socket through `net.createServer`, so
 * `pipe` is never actually invoked. It's defined defensively so a
 * future refactor that does call it doesn't crash.
 */
class VirtualSocket extends EventEmitter {
    public writable = true;
    public lmxClosed = false;
    public destroyTimeout: NodeJS.Timeout | undefined;

    constructor(private readonly onFrame: (frame: any) => void) {
        const routineId = 'ddl-routine-WoFE6z7qO40Cz1uHkd';
        routineEnter(routineId, "VirtualSocket.constructor");
        super();
        // The broker registers many listeners; lift the warning ceiling
        // so multi-listener flows don't pollute logs. 256 is well above
        // the per-connection listener count the broker installs (< 8).
        this.setMaxListeners(256);
    }

    /// Capture the broker's reply. The wire framing matches the TCP
    /// path: one or more newline-terminated JSON objects per write.
    /// We forward each parsed object to the bridge's correlation map.
    write(data: string | Buffer, encoding?: any, cb?: any): boolean {
        const routineId = 'ddl-routine-bJjgk0J2Y3jw4yPBC7';
        routineEnter(routineId, "VirtualSocket.write");
        const text = typeof data === 'string' ? data : data.toString('utf8');
        // The broker always writes exactly one frame at a time
        // (`JSON.stringify(data) + '\n'`), but split-on-newline is the
        // robust choice — defends against any future change.
        for (const line of text.split('\n')) {
            if (line.length === 0) continue;
            try {
                const frame = JSON.parse(line);
                this.onFrame(frame);
            } catch {
                // Drop malformed frames silently — the TCP path also
                // emits a 'warning' here; we don't have a place to
                // surface that and it would only fire on a bug.
            }
        }
        // The TCP `send` path uses a `(err) => {...; cb && process.nextTick(cb)}`
        // shape. Honour both call-styles (encoding+cb, or just cb).
        const callback = typeof encoding === 'function' ? encoding : cb;
        if (typeof callback === 'function') {
            process.nextTick(callback);
        }
        return true;
    }

    setNoDelay(_value: boolean): void {
      const routineId = 'ddl-routine-Vrs-ZEZMgsE_Dg8ajg';
      routineEnter(routineId, "VirtualSocket.setNoDelay");
        // No-op; the broker calls this defensively in its TCP path.
    }

    destroy(): void {
        const routineId = 'ddl-routine-BWbtmhL8y5oFTERAvH';
        routineEnter(routineId, "VirtualSocket.destroy");
        if (this.lmxClosed) return;
        this.lmxClosed = true;
        this.writable = false;
        this.emit('end');
    }

    end(): void {
        const routineId = 'ddl-routine-tCwQ_9Cia5ybFRg5-r';
        routineEnter(routineId, "VirtualSocket.end");
        this.destroy();
    }

    removeAllListeners(event?: string | symbol): this {
        const routineId = 'ddl-routine-7swZayhZQfvHIFSgKh';
        routineEnter(routineId, "VirtualSocket.removeAllListeners");
        return super.removeAllListeners(event);
    }

    pipe<T>(target: T): T {
        const routineId = 'ddl-routine-UW5cpE6tXO9q0ekt-Z';
        routineEnter(routineId, "VirtualSocket.pipe");
        return target;
    }
}

/**
 * Bridge between in-process callers (HTTP, embedded scripts, tests)
 * and a `Broker1` instance. Construct one per broker — concurrency is
 * fine, every method correlates replies on a unique per-request uuid.
 */
export class InProcessBridge {
    private readonly socket: VirtualSocket;
    private readonly inflight = new Map<string, Pending>();
    private readonly defaultTimeoutMs: number;
    private closed = false;

    constructor(
        public readonly broker: Broker1,
        opts?: {defaultTimeoutMs?: number}
    ) {
        const routineId = 'ddl-routine-1mPSPtg4mUld07ty_v';
        routineEnter(routineId, "InProcessBridge.constructor");
        this.defaultTimeoutMs = opts?.defaultTimeoutMs ?? 60_000;
        this.socket = new VirtualSocket(frame => this.onBrokerFrame(frame));

        // Register the virtual socket with the broker exactly the way
        // a real TCP connection would. This is what gives bridge-owned
        // holds the same ownership semantics as TCP-owned holds — when
        // we call `broker.cleanupConnection(socket)` on shutdown, the
        // broker walks `wsToKeys`/`wsToUUIDs` and force-releases every
        // outstanding hold, just like a TCP disconnect.
        broker.connectedClients.add(this.socket as unknown as LMXSocket);
        broker.wsToKeys.set(this.socket as unknown as LMXSocket, {});
        broker.wsToUUIDs.set(this.socket as unknown as LMXSocket, {});
    }

    /// Acquire a single key. Returns the broker's reply frame
    /// verbatim — the caller decides whether `acquired:false` is a
    /// validation error (HTTP 400) or a queued-grant (HTTP 200 with
    /// `acquired:false`).
    async lock(data: {key: string, ttl?: number | null, max?: number, force?: boolean, keepLocksAfterDeath?: boolean}): Promise<any> {
        const routineId = 'ddl-routine-tFdYCFhXStELjYbXy6';
        routineEnter(routineId, "InProcessBridge.lock");
        const uuid = UUID.v4();
        const payload = {
            type: 'lock',
            uuid,
            key: data.key,
            ttl: data.ttl ?? null,
            max: data.max,
            force: data.force ?? false,
            pid: process.pid,
            keepLocksAfterDeath: data.keepLocksAfterDeath ?? false,
            retryCount: 0,
        };
        const reply = await this.dispatch(uuid, () => this.broker.lock(payload, this.socket as unknown as LMXSocket));
        return {...reply, _bridgeRequestUuid: uuid};
    }

    async unlock(data: {key: string, lockUuid?: string | null, force?: boolean}): Promise<any> {
        const routineId = 'ddl-routine-ICOCnLZh0zJDIkBZzX';
        routineEnter(routineId, "InProcessBridge.unlock");
        const uuid = UUID.v4();
        const payload: any = {
            type: 'unlock',
            uuid,
            key: data.key,
            force: data.force ?? false,
        };
        if (data.lockUuid) payload._uuid = data.lockUuid;
        return this.dispatch(uuid, () => this.broker.unlock(payload, this.socket as unknown as LMXSocket));
    }

    async acquireMany(keys: string[], ttlMs?: number | null): Promise<any> {
        const routineId = 'ddl-routine-8d_2J7w0WRPljKdeWG';
        routineEnter(routineId, "InProcessBridge.acquireMany");
        const uuid = UUID.v4();
        const payload = {
            type: 'acquire-many',
            uuid,
            keys,
            ttl: ttlMs ?? null,
            pid: process.pid,
            keepLocksAfterDeath: false,
        };
        return this.dispatch(uuid, () => this.broker.acquireMany(payload, this.socket as unknown as LMXSocket));
    }

    async releaseMany(lockUuid: string): Promise<any> {
        const routineId = 'ddl-routine-RNu7juP5ClqIoEqukL';
        routineEnter(routineId, "InProcessBridge.releaseMany");
        const uuid = UUID.v4();
        const payload = {type: 'release-many', uuid, lockUuid};
        return this.dispatch(uuid, () => this.broker.releaseMany(payload, this.socket as unknown as LMXSocket));
    }

    /// Tear down the bridge. Releases every hold owned by the virtual
    /// socket via the broker's normal disconnect path, then unwires
    /// the bridge from the broker so the broker forgets about it.
    shutdown(): void {
        const routineId = 'ddl-routine-WDP4tMm8MVv3-hNgpO';
        routineEnter(routineId, "InProcessBridge.shutdown");
        if (this.closed) return;
        this.closed = true;
        // Flush any pending requests with a clear error.
        for (const [, pending] of this.inflight) {
            clearTimeout(pending.timer);
            pending.reject(new Error('InProcessBridge: shutdown'));
        }
        this.inflight.clear();
        // Force-release every hold we own. `cleanupConnection` is the
        // exact path a TCP disconnect goes through.
        try {
            this.broker.cleanupConnection(this.socket as unknown as LMXSocket);
        } catch {
            // Defensive: never throw from shutdown.
        }
        this.socket.destroy();
    }

    /// Visible for tests / introspection.
    get pendingCount(): number {
        const routineId = 'ddl-routine-tlRx3rXAPmeBwsoF4W';
        routineEnter(routineId, "InProcessBridge.pendingCount");
        return this.inflight.size;
    }

    // ------- internals -------

    private dispatch(uuid: string, send: () => void): Promise<any> {
        const routineId = 'ddl-routine-764GlhbPKjrkOMOpLN';
        routineEnter(routineId, "InProcessBridge.dispatch");
        if (this.closed) {
            return Promise.reject(new Error('InProcessBridge: closed'));
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (this.inflight.delete(uuid)) {
                    reject(new Error(`InProcessBridge: request ${uuid} timed out after ${this.defaultTimeoutMs}ms`));
                }
            }, this.defaultTimeoutMs);
            // Don't keep the event loop alive solely for this timer.
            if (typeof timer.unref === 'function') timer.unref();
            this.inflight.set(uuid, {resolve, reject, timer});
            try {
                send();
            } catch (err) {
                this.inflight.delete(uuid);
                clearTimeout(timer);
                reject(err as Error);
            }
        });
    }

    private onBrokerFrame(frame: any): void {
        const routineId = 'ddl-routine-WlHkfye8_YVOVioEwo';
        routineEnter(routineId, "InProcessBridge.onBrokerFrame");
        if (!frame || typeof frame !== 'object') return;
        const uuid = frame.uuid;
        if (typeof uuid !== 'string') return;
        const pending = this.inflight.get(uuid);
        if (!pending) return;
        // For `lock` requests the broker can emit multiple frames
        // (initial `acquired:false` queued, later `acquired:true` on
        // re-grant). The bridge resolves on the first frame for a
        // given uuid; long-poll callers should use `wait_ms` on the
        // HTTP layer (future work) rather than reading multiple
        // replies from this single dispatch.
        this.inflight.delete(uuid);
        clearTimeout(pending.timer);
        pending.resolve(frame);
    }
}

export default InProcessBridge;
