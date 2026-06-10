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
import {LMXRequestType} from './protocol';

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
 * In-process stand-in for `net.Socket` that the `Broker1` can treat
 * as an ordinary connected peer. The broker's hot path types every
 * connection as `LMXSocket extends net.Socket`, so this class has to
 * present enough of that surface to behave faithfully under three
 * orthogonal pressures:
 *
 *   1. **Method/property surface** — every method the broker actually
 *      calls and every property it actually reads must exist and behave
 *      sensibly. Missing methods would crash; missing properties would
 *      silently produce `undefined` and break invariants like
 *      `if (!ws.writable)` checks.
 *
 *   2. **Async semantics** — real `net.Socket` callbacks (the `write`
 *      cb, `'data'` events on the peer's read side, lifecycle events
 *      like `'finish'`/`'end'`/`'close'`) **never** fire synchronously
 *      inside the call that triggered them. The kernel/libuv always
 *      interpose at least one tick. The previous implementation fired
 *      `onFrame` synchronously inside `write()`, which meant the
 *      bridge's awaiter could resume mid-broker-handler and observe
 *      half-mutated broker state. Every callback below is dispatched
 *      via `process.nextTick`, which is the closest faithful mimic of
 *      "the data crossed the boundary."
 *
 *   3. **Lifecycle ordering** — `end()` must emit `'finish'` then
 *      `'end'` then `'close'`; `destroy(err)` must emit `'error'`
 *      (only when an Error was supplied) then `'close'`; both flows
 *      must be idempotent. This matches the documented stream/socket
 *      contract operators rely on when they wire `.once('end', …)`,
 *      `.once('error', …)`, etc.
 *
 * This class does NOT pretend to fully implement `net.Socket` (there
 * are dozens of internal `_writev`/`_write` hooks meant only for the
 * stream subsystem). It implements the documented public surface plus
 * the LMX-specific extension fields (`lmxClosed`, `destroyTimeout`)
 * that `LMXSocket` adds. The `as unknown as LMXSocket` cast at the
 * call site is the explicit acknowledgement that we're a structural
 * subset, not a full subclass.
 */
const NEXT_TICK = process.nextTick;

export class VirtualSocket extends EventEmitter {
    // ---- net.Socket-mirroring state ---------------------------------
    public writable = true;
    public readable = true;
    public destroyed = false;
    public connecting = false;
    public pending = false;
    public bufferSize = 0;
    public bytesRead = 0;
    public bytesWritten = 0;
    public timeout = 0;
    public allowHalfOpen = false;
    public localAddress = 'inproc';
    public localPort = 0;
    public remoteAddress = 'inproc';
    public remoteFamily: 'IPv4' | 'IPv6' = 'IPv4';
    public remotePort = 0;

    // ---- LMXSocket extensions ---------------------------------------
    public lmxClosed = false;
    public destroyTimeout: NodeJS.Timeout | undefined = undefined;

    // ---- internals --------------------------------------------------
    private finishEmitted = false;
    private endEmitted = false;
    private closeEmitted = false;

    constructor(private readonly onFrame: (frame: any) => void) {
        super();
        const routineId = 'ddl-routine-WoFE6z7qO40Cz1uHkd';
        routineEnter(routineId, "VirtualSocket.constructor");
        // The broker installs ~6 listeners per accepted socket and
        // also subscribes from the parser side. 256 is generous for
        // any plausible future addition without spamming
        // MaxListenersExceededWarning into stderr.
        this.setMaxListeners(256);
    }

    /**
     * `readyState` mirrors `net.Socket.readyState` for any operator
     * code (or a future debugger) that introspects the socket.
     */
    get readyState(): 'open' | 'readOnly' | 'writeOnly' | 'closed' | 'opening' {
        if (this.destroyed) return 'closed';
        if (this.writable && this.readable) return 'open';
        if (this.writable) return 'writeOnly';
        if (this.readable) return 'readOnly';
        return 'closed';
    }

    /**
     * Accept the broker's reply frames and forward them to the bridge.
     *
     * The broker always writes exactly one newline-terminated JSON
     * object per call (`JSON.stringify(data) + '\n'`). We split on
     * newline anyway as future-proofing.
     *
     * Async-correctness: BOTH the `onFrame` callback AND the write
     * callback are scheduled via `process.nextTick`. The previous
     * implementation called `onFrame` synchronously inside `write()`,
     * which meant the bridge's awaiter could resume *during* the
     * broker's send call and observe state the broker hadn't yet
     * finished mutating. Real `net.Socket` always crosses at least
     * one event-loop tick between sender's `write()` and receiver's
     * `'data'` event; this implementation does the same.
     */
    write(
        data: string | Buffer | Uint8Array,
        encoding?: BufferEncoding | ((err?: Error | null) => void),
        cb?: (err?: Error | null) => void
    ): boolean {
        const routineId = 'ddl-routine-bJjgk0J2Y3jw4yPBC7';
        routineEnter(routineId, "VirtualSocket.write");

        // net.Socket accepts (data), (data, encoding), (data, cb),
        // and (data, encoding, cb). Normalize to a single callback.
        const callback: ((err?: Error | null) => void) | undefined =
            typeof encoding === 'function' ? encoding : cb;
        const enc: BufferEncoding =
            typeof encoding === 'string' ? encoding : 'utf8';

        if (this.destroyed || !this.writable) {
            const err = Object.assign(
                new Error('Cannot call write after a stream was destroyed'),
                {code: 'ERR_STREAM_DESTROYED'},
            );
            if (callback) NEXT_TICK(callback, err);
            return false;
        }

        let buf: Buffer;
        if (typeof data === 'string') {
            buf = Buffer.from(data, enc);
        } else if (Buffer.isBuffer(data)) {
            buf = data;
        } else if (data instanceof Uint8Array) {
            buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        } else {
            const err = new TypeError(
                `VirtualSocket.write: unsupported data type ${typeof data}`,
            );
            if (callback) NEXT_TICK(callback, err);
            return false;
        }

        this.bytesWritten += buf.byteLength;
        const text = buf.toString('utf8');

        for (const line of text.split('\n')) {
            if (line.length === 0) continue;
            let frame: any;
            try {
                frame = JSON.parse(line);
            } catch {
                // Match the TCP path: malformed frames are dropped.
                // (The real socket path emits a 'warning' here, but
                // we have no plumbing to surface it from a write call
                // and the bridge protocol is internal — a malformed
                // frame would be a bug, not a client misbehavior.)
                continue;
            }
            this.bytesRead += line.length + 1;
            const captured = frame;
            // FIFO order across frames is preserved because
            // process.nextTick is a queue.
            NEXT_TICK(() => {
                if (this.destroyed) return;
                try {
                    this.onFrame(captured);
                } catch (err) {
                    this.emit('error', err);
                }
            });
        }

        if (callback) NEXT_TICK(callback, null);
        return true;
    }

    /**
     * Half-close the write side. Real `net.Socket.end()` sequence:
     *   - flush any pending writes
     *   - emit `'finish'` (write side fully drained)
     *   - peer FIN-ACK arrives → emit `'end'`
     *   - resources released → emit `'close'`
     *
     * For our virtual socket there's no peer to FIN-ACK, so we
     * synthesize all three on `nextTick` in the documented order.
     * Idempotent: a second `end()` is a no-op.
     */
    end(
        data?: any,
        encoding?: BufferEncoding | (() => void),
        cb?: () => void,
    ): this {
        const routineId = 'ddl-routine-tCwQ_9Cia5ybFRg5-r';
        routineEnter(routineId, "VirtualSocket.end");

        // net.Socket.end signatures: (), (data), (data, encoding),
        // (data, encoding, cb), (cb), (data, cb).
        let endCb: (() => void) | undefined;
        let payload: any = data;
        let enc: BufferEncoding | undefined;
        if (typeof data === 'function') {
            endCb = data as () => void;
            payload = undefined;
        } else if (typeof encoding === 'function') {
            endCb = encoding as () => void;
        } else {
            enc = encoding as BufferEncoding | undefined;
            endCb = cb;
        }

        if (this.destroyed) {
            if (endCb) NEXT_TICK(endCb);
            return this;
        }

        const finalize = () => {
            if (!this.writable) return; // re-entrancy guard
            this.writable = false;
            if (!this.finishEmitted) {
                this.finishEmitted = true;
                this.emit('finish');
            }
            if (!this.endEmitted) {
                this.endEmitted = true;
                this.emit('end');
            }
            // 'close' lands one tick later, mirroring net.Socket.
            NEXT_TICK(() => {
                this.readable = false;
                this.destroyed = true;
                this.lmxClosed = true;
                if (!this.closeEmitted) {
                    this.closeEmitted = true;
                    this.emit('close', false);
                }
                if (endCb) endCb();
            });
        };

        if (payload !== undefined) {
            // Drain the trailing payload through write() so its
            // bytes count toward bytesWritten and any frames it
            // contains reach the bridge before close.
            this.write(payload, enc as any, () => NEXT_TICK(finalize));
        } else {
            NEXT_TICK(finalize);
        }
        return this;
    }

    /**
     * Abrupt close. Idempotent. Emits `'error'` (if an Error was
     * supplied) then `'close'` on the next tick. After `destroy()`,
     * `write()` returns false with `ERR_STREAM_DESTROYED` on the cb.
     */
    destroy(err?: Error | null): this {
        const routineId = 'ddl-routine-BWbtmhL8y5oFTERAvH';
        routineEnter(routineId, "VirtualSocket.destroy");
        if (this.destroyed) return this;
        this.writable = false;
        this.readable = false;
        this.destroyed = true;
        this.lmxClosed = true;
        NEXT_TICK(() => {
            if (err) this.emit('error', err);
            if (!this.closeEmitted) {
                this.closeEmitted = true;
                this.emit('close', !!err);
            }
        });
        return this;
    }

    /// `address()` is what `net.Server` connection callbacks read on
    /// every accepted socket. We return the same shape so future
    /// introspection code doesn't crash on `.address().port`.
    address(): {address: string, family: string, port: number} {
        return {address: this.localAddress, family: this.remoteFamily, port: this.localPort};
    }

    /**
     * The broker calls `pipe(createParser())` on accepted sockets so
     * inbound bytes flow through the NDJSON parser. The bridge never
     * goes through that path — inbound traffic is delivered via
     * direct method calls (`broker.lock(payload, virtualSocket)`).
     * `pipe` is an identity no-op so any future code that does call
     * it doesn't crash, and so `ws.pipe(parser).on('data', …)` still
     * lets the caller subscribe to the parser they passed in.
     */
    pipe<T>(target: T): T {
        const routineId = 'ddl-routine-UW5cpE6tXO9q0ekt-Z';
        routineEnter(routineId, "VirtualSocket.pipe");
        return target;
    }

    unpipe(_target?: any): this {
        return this;
    }

    // ---- chainable no-op tuning methods -----------------------------
    // All of these exist on net.Socket and are called defensively by
    // socket-tuning code. None of them have a meaningful in-process
    // analogue. They return `this` to preserve the documented
    // chainable signature so `socket.setNoDelay(true).setKeepAlive(...)`
    // patterns survive.

    setNoDelay(_value?: boolean): this {
        const routineId = 'ddl-routine-Vrs-ZEZMgsE_Dg8ajg';
        routineEnter(routineId, "VirtualSocket.setNoDelay");
        return this;
    }

    setKeepAlive(_enable?: boolean, _initialDelay?: number): this {
        return this;
    }

    setTimeout(timeout: number, callback?: () => void): this {
        // Capture the requested timeout so debug/observation code can
        // read it back; we don't actually fire 'timeout' on idle since
        // there's no real I/O to time out. If a caller needs that
        // behavior they can install the listener directly.
        this.timeout = timeout;
        if (callback) this.once('timeout', callback);
        return this;
    }

    setEncoding(_encoding?: BufferEncoding): this {
        return this;
    }

    unref(): this { return this; }
    ref(): this { return this; }
    pause(): this { return this; }
    resume(): this { return this; }
    cork(): void { /* noop */ }
    uncork(): void { /* noop */ }

    removeAllListeners(event?: string | symbol): this {
        const routineId = 'ddl-routine-7swZayhZQfvHIFSgKh';
        routineEnter(routineId, "VirtualSocket.removeAllListeners");
        return super.removeAllListeners(event);
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
            type: LMXRequestType.Lock,
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
            type: LMXRequestType.Unlock,
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
            type: LMXRequestType.AcquireMany,
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
        const payload = {type: LMXRequestType.ReleaseMany, uuid, lockUuid};
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
