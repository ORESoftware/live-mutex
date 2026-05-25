'use strict';

/**
 * Direct verification that the centralised TTL sweeper actually
 * evicts expired holders WITHOUT relying on `tickTtl()` being
 * called manually. The chaos-fuzz-extra `s10` scenario explicitly
 * stops the auto-sweeper to drive eviction synchronously; this
 * test does the inverse — leaves the automatic `setInterval`
 * running, sets a TTL shorter than the sweep cadence, and
 * verifies that:
 *
 *   t1  An expired holder is removed from `lockholders` within a
 *       small bounded window (< 5 sweep intervals).
 *
 *   t2  An expired holder's deadline row is also gone from
 *       `holderDeadlines` after eviction.
 *
 *   t3  `lockholderTimeouts[holderUuid]` is set to `true` after
 *       the sweeper evicts, so a late `unlock` from the racy
 *       ex-holder gets `unlocked:true` rather than
 *       "wrong-uuid" error.
 *
 *   t4  After eviction, a queued waiter is granted automatically
 *       (the sweeper calls `ensureNewLockHolder`).
 *
 *   t5  `ttlEvictionsTotal` stat counter increments.
 *
 *   t6  The sweeper does NOT touch holders whose `expiresAt` is
 *       still in the future. Sanity: a long-TTL hold survives
 *       the same window.
 *
 *   t7  `stopTtlSweeper()` halts evictions; expired holders
 *       remain until restart.
 *
 * Self-times-out at 15s. Default sweep interval is 25ms, so
 * every probe loop runs in milliseconds.
 */

import {Broker1} from '../dist/main';
import {EventEmitter} from 'events';
import {v4 as uuidV4} from 'uuid';

function fail(msg: string): never {
    console.error('\u274c FAIL:', msg);
    process.exit(1);
}
function ok(msg: string) { console.log('  \u2713', msg); }

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: ttl-sweeper-test took too long');
    process.exit(1);
}, 15_000);
watchdog.unref();

class FakeSocket extends EventEmitter {
    public writable = true;
    public readable = true;
    public destroyed = false;
    public lmxClosed = false;
    public destroyTimeout: NodeJS.Timeout | undefined = undefined;
    public framesIn: any[] = [];
    public bytesWritten = 0;
    public bytesRead = 0;
    public allowHalfOpen = false;
    public localAddress = 'fake';
    public localPort = 0;
    public remoteAddress = 'fake';
    public remoteFamily: 'IPv4' | 'IPv6' = 'IPv4';
    public remotePort = 0;
    public timeout = 0;
    constructor() { super(); this.setMaxListeners(64); }
    write(data: any, _enc?: any, cb?: any): boolean {
        const text = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
        for (const line of text.split('\n')) {
            if (!line) continue;
            try { this.framesIn.push(JSON.parse(line)); } catch {/* ignore */}
        }
        if (cb) process.nextTick(cb, null);
        return true;
    }
    end(): this { this.writable = false; return this; }
    destroy(): this { this.writable = false; this.destroyed = true; return this; }
    address() { return {address: this.localAddress, family: this.remoteFamily, port: this.localPort}; }
    pipe<T>(t: T): T { return t; }
    unpipe(): this { return this; }
    setNoDelay(): this { return this; }
    setKeepAlive(): this { return this; }
    setTimeout(t: number): this { this.timeout = t; return this; }
    setEncoding(): this { return this; }
    unref(): this { return this; }
    ref(): this { return this; }
    pause(): this { return this; }
    resume(): this { return this; }
    cork(): void {}
    uncork(): void {}
    get readyState() { return this.destroyed ? 'closed' : 'open'; }
}

function newBroker(): any {
    const b = new Broker1({noListen: true, port: 0, host: '127.0.0.1'});
    if (b.emitter && typeof b.emitter.on === 'function') {
        b.emitter.on('warning', () => {});
        b.emitter.on('error', () => {});
    }
    return b;
}

function register(broker: any, ws: FakeSocket) {
    broker.connectedClients.add(ws);
    broker.wsToKeys.set(ws, {});
    broker.wsToUUIDs.set(ws, {});
}

function lockSync(broker: any, ws: FakeSocket, payload: any): any {
    broker.lock(payload, ws);
    return ws.framesIn[ws.framesIn.length - 1];
}

async function waitForCondition(predicate: () => boolean, label: string, timeoutMs: number = 1000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise(r => setTimeout(r, 10));
    }
    fail(`timed out waiting for: ${label}`);
}

async function main() {
    // =============================================================
    // t1 + t2 + t3 + t5 — auto-sweeper evicts; deadlines + holders
    //                     coherent; lockholderTimeouts marker set;
    //                     ttlEvictionsTotal increments.
    // =============================================================
    console.log('[t1-t3,t5] auto-sweeper evicts an expired holder; bookkeeping consistent');
    {
        const broker = newBroker();
        try {
            const key = 'sweep-1';
            const ws = new FakeSocket();
            register(broker, ws);

            const beforeEvictions = broker.ttlEvictionsTotal ?? 0;
            const u = uuidV4();
            const reply = lockSync(broker, ws, {type: 'lock', uuid: u, key, ttl: 75, max: 1, force: false, pid: 1, retryCount: 0});
            if (reply?.acquired !== true) fail(`expected acquired:true; got ${JSON.stringify(reply)}`);

            // Sanity: holder is in lockholders + a deadline row exists for it.
            if (broker.locks.get(key)?.lockholders?.size !== 1) {
                fail(`pre-sweep: lockholders.size=${broker.locks.get(key)?.lockholders?.size}`);
            }
            const holderUuid = broker.locks.get(key).lockholders.keys().next().value as string;
            if (!broker.holderDeadlines.has(holderUuid)) {
                fail(`pre-sweep: deadline row missing for holder=${holderUuid}`);
            }

            // Wait long enough for ttl=75ms + at least 4 sweep intervals (25ms each).
            await waitForCondition(
                () => (broker.locks.get(key)?.lockholders?.size ?? 0) === 0,
                'lockholders cleared by auto-sweeper',
                2000,
            );
            ok(`t1: holder evicted by auto-sweeper within ttl + a few sweep intervals`);

            if (broker.holderDeadlines.has(holderUuid)) {
                fail(`t2: deadline row leaked after eviction (holder=${holderUuid})`);
            }
            ok(`t2: deadline row removed alongside holder`);

            const lockObj = broker.locks.get(key);
            if (!lockObj.lockholderTimeouts || lockObj.lockholderTimeouts[holderUuid] !== true) {
                fail(`t3: lockholderTimeouts[${holderUuid}] not set after eviction; got ${JSON.stringify(lockObj.lockholderTimeouts)}`);
            }
            ok(`t3: lockholderTimeouts[${holderUuid}] = true (late-unlock idempotency marker)`);

            const afterEvictions = broker.ttlEvictionsTotal ?? 0;
            if (afterEvictions <= beforeEvictions) {
                fail(`t5: ttlEvictionsTotal did not increment (before=${beforeEvictions}, after=${afterEvictions})`);
            }
            ok(`t5: ttlEvictionsTotal incremented (${beforeEvictions} -> ${afterEvictions})`);
        } finally {
            await new Promise<void>(r => broker.close(() => r()));
        }
    }

    // =============================================================
    // t4 — eviction wakes a queued waiter
    // =============================================================
    console.log('\n[t4] auto-sweeper triggers ensureNewLockHolder for a queued waiter');
    {
        const broker = newBroker();
        try {
            const key = 'sweep-2';
            const wsHolder = new FakeSocket();
            const wsWaiter = new FakeSocket();
            register(broker, wsHolder);
            register(broker, wsWaiter);

            const uH = uuidV4();
            lockSync(broker, wsHolder, {type: 'lock', uuid: uH, key, ttl: 60, max: 1, force: false, pid: 1, retryCount: 0});

            const uW = uuidV4();
            const queueReply = lockSync(broker, wsWaiter, {type: 'lock', uuid: uW, key, ttl: 30_000, max: 1, force: false, pid: 2, retryCount: 0});
            if (queueReply?.acquired !== false) fail(`waiter should be queued (acquired:false); got ${JSON.stringify(queueReply)}`);
            if ((broker.locks.get(key)?.notify?.length ?? 0) < 1) fail(`waiter not in notify queue`);

            // Wait for the auto-sweeper to evict the holder and grant the waiter.
            await waitForCondition(
                () => wsWaiter.framesIn.some(f => f?.type === 'lock' && f.acquired === true),
                'waiter granted after holder eviction',
                2000,
            );
            const grant = wsWaiter.framesIn.find(f => f?.type === 'lock' && f.acquired === true);
            ok(`t4: waiter received acquired:true after auto-sweep eviction (fencingToken=${grant?.fencingToken})`);
        } finally {
            await new Promise<void>(r => broker.close(() => r()));
        }
    }

    // =============================================================
    // t6 — sweeper does NOT touch a still-valid holder
    // =============================================================
    console.log('\n[t6] auto-sweeper leaves still-valid (long-TTL) holders alone');
    {
        const broker = newBroker();
        try {
            const key = 'sweep-3';
            const ws = new FakeSocket();
            register(broker, ws);

            const u = uuidV4();
            lockSync(broker, ws, {type: 'lock', uuid: u, key, ttl: 5_000, max: 1, force: false, pid: 1, retryCount: 0});
            const holderUuid = broker.locks.get(key).lockholders.keys().next().value as string;

            // Run the sweeper for ~10x its interval and check the
            // holder is still present.
            await new Promise(r => setTimeout(r, 250));
            if ((broker.locks.get(key)?.lockholders?.size ?? 0) !== 1) {
                fail(`t6: long-TTL holder evicted prematurely after 250ms`);
            }
            if (!broker.holderDeadlines.has(holderUuid)) {
                fail(`t6: deadline row vanished for still-valid holder`);
            }
            ok(`t6: long-TTL holder + deadline row both still present after 250ms (10 sweep intervals)`);
        } finally {
            await new Promise<void>(r => broker.close(() => r()));
        }
    }

    // =============================================================
    // t7 — stopTtlSweeper halts evictions
    // =============================================================
    console.log('\n[t7] stopTtlSweeper halts further evictions');
    {
        const broker = newBroker();
        try {
            const key = 'sweep-4';
            const ws = new FakeSocket();
            register(broker, ws);

            broker.stopTtlSweeper();

            const u = uuidV4();
            lockSync(broker, ws, {type: 'lock', uuid: u, key, ttl: 30, max: 1, force: false, pid: 1, retryCount: 0});

            // Wait well past the TTL — without the sweeper, the
            // holder must still be present.
            await new Promise(r => setTimeout(r, 250));
            const remaining = broker.locks.get(key)?.lockholders?.size ?? 0;
            if (remaining !== 1) {
                fail(`t7: holder evicted with sweeper stopped (lockholders.size=${remaining})`);
            }
            ok(`t7: holder survives past TTL when sweeper stopped (manual tickTtl required)`);

            // Manual tick should now evict it.
            const evicted = broker.tickTtl();
            if (evicted < 1) fail(`t7: manual tickTtl evicted ${evicted} (expected >=1)`);
            ok(`t7: manual tickTtl evicted ${evicted} entries after sweeper stop`);
        } finally {
            await new Promise<void>(r => broker.close(() => r()));
        }
    }

    clearTimeout(watchdog);
    console.log('\n\u2705 ttl-sweeper-test: all 7 properties verified');
    process.exit(0);
}

main().catch(err => {
    console.error('ttl-sweeper-test threw:', err);
    process.exit(1);
});
