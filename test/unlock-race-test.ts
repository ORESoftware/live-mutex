'use strict';

/**
 * Regression tests for the broker's unlock + cleanupConnection paths.
 * Targets four discrete failure modes that surfaced during the
 * VirtualSocket / sweeper hardening work:
 *
 *   r1  Phantom-unlock-with-wrong-_uuid (semaphore, max>1): a
 *       caller sends `{type:'unlock', _uuid:'WRONG', force:true}`
 *       on a key with two living holders. Current code reports
 *       `unlocked:true` even though neither holder was removed
 *       AND the lock object still has both holders. The reply
 *       should NOT claim `unlocked:true` when no holder was
 *       actually removed.
 *
 *   r2  Phantom-unlock-with-wrong-_uuid (exclusive, max=1): same
 *       call shape, on a key with `max=1`. Current code falls into
 *       the "Traditional force behavior - remove all lock holders"
 *       else-branch and **wipes the unrelated valid holder** even
 *       though `_uuid` doesn't match. That's a worse-than-phantom:
 *       the caller can evict somebody else's hold by guessing.
 *
 *   r3  cleanupConnection over-evicts a semaphore: client A and
 *       client B both hold key K (max=2). Client A drops the
 *       socket without releasing. The broker's cleanup walks
 *       lockObj and calls `unlock({force:true, key:k}, ws)`
 *       without `_uuid`, which falls into the wipe-all branch and
 *       evicts BOTH A's slot AND B's still-valid slot. After
 *       cleanup, B's slot must still be present.
 *
 *   r4  cleanupConnection's notify-queue scrub uses
 *       `Object.keys(uuids)` where `uuids` is already an Array.
 *       That iterates string indices `'0','1',…` and never
 *       removes the actual uuid keys, leaving stale waiter
 *       entries from the closing client in the notify queue. A
 *       future grant cycle would target a dead `ws`. We assert
 *       the closing client's queued-but-not-granted requests are
 *       removed from `lck.notify`.
 *
 * Self-times-out at 30s. Each scenario is fully self-contained
 * (`noListen` broker; in-proc only). No TCP, no port allocation.
 */

import * as assert from 'assert';
import {Broker1} from '../dist/main';
import {v4 as uuidV4} from 'uuid';
import {EventEmitter} from 'events';

function fail(msg: string): never {
    console.error('\u274c FAIL:', msg);
    process.exit(1);
}
function ok(msg: string) { console.log('  \u2713', msg); }

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: unlock-race-test took too long');
    process.exit(1);
}, 30_000);
watchdog.unref();

/**
 * Minimal stand-in for an LMXSocket used by the broker hot path.
 * The broker reads `writable`, `lmxClosed`, calls `write()` for
 * reply frames and listens for `close`/`end`/`error`. We do NOT
 * use VirtualSocket here because we want to inspect every reply
 * frame the broker emits to a given client without the
 * InProcessBridge correlation map in the way.
 */
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

    constructor() {
        super();
        this.setMaxListeners(64);
    }

    write(data: any, _enc?: any, cb?: (err?: Error | null) => void): boolean {
        if (this.destroyed) {
            if (cb) process.nextTick(cb, Object.assign(new Error('destroyed'), {code: 'ERR_STREAM_DESTROYED'}));
            return false;
        }
        const text = typeof data === 'string' ? data
            : Buffer.isBuffer(data) ? data.toString('utf8')
            : String(data);
        this.bytesWritten += Buffer.byteLength(text);
        for (const line of text.split('\n')) {
            if (!line) continue;
            try {
                this.framesIn.push(JSON.parse(line));
            } catch {
                // ignore
            }
        }
        if (cb) process.nextTick(cb, null);
        return true;
    }

    end(): this {
        this.writable = false;
        process.nextTick(() => {
            this.readable = false;
            this.destroyed = true;
            this.lmxClosed = true;
            this.emit('end');
            this.emit('close', false);
        });
        return this;
    }

    destroy(): this {
        this.writable = false;
        this.readable = false;
        this.destroyed = true;
        this.lmxClosed = true;
        process.nextTick(() => this.emit('close', false));
        return this;
    }

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
    get readyState() {
        if (this.destroyed) return 'closed';
        if (this.writable && this.readable) return 'open';
        return 'closed';
    }
}

/**
 * Drive the broker-side hot path by calling the same `lock()` /
 * `unlock()` methods that the TCP `onData` dispatch invokes
 * directly. Returns the broker's reply frame, captured from the
 * fake socket's write buffer.
 */
function lockSync(broker: any, ws: FakeSocket, payload: any): any {
    const before = ws.framesIn.length;
    broker.lock(payload, ws);
    return ws.framesIn[ws.framesIn.length - 1] ?? null;
}
function unlockSync(broker: any, ws: FakeSocket, payload: any): any {
    broker.unlock(payload, ws);
    return ws.framesIn[ws.framesIn.length - 1] ?? null;
}

function newBroker(): any {
    const b = new Broker1({noListen: true, port: 0, host: '127.0.0.1'});
    if (b.emitter && typeof b.emitter.on === 'function') {
        b.emitter.on('warning', () => {});
        b.emitter.on('error', () => {});
    }
    return b;
}

async function main() {
    // =============================================================
    // r1 — semaphore phantom unlock with wrong _uuid
    // =============================================================
    console.log('[r1] semaphore (max=2): force-unlock with wrong _uuid must NOT report unlocked:true while holders survive');
    {
        const broker = newBroker();
        try {
            const key = 'r1-sem';
            const wsA = new FakeSocket();
            const wsB = new FakeSocket();
            const wsC = new FakeSocket();  // attacker / confused caller
            broker.connectedClients.add(wsA);
            broker.connectedClients.add(wsB);
            broker.connectedClients.add(wsC);
            broker.wsToKeys.set(wsA, {});
            broker.wsToKeys.set(wsB, {});
            broker.wsToKeys.set(wsC, {});
            broker.wsToUUIDs.set(wsA, {});
            broker.wsToUUIDs.set(wsB, {});
            broker.wsToUUIDs.set(wsC, {});

            const uA = uuidV4();
            const uB = uuidV4();
            const rA = lockSync(broker, wsA, {type: 'lock', uuid: uA, key, ttl: null, max: 2, force: false, pid: 1, retryCount: 0});
            const rB = lockSync(broker, wsB, {type: 'lock', uuid: uB, key, ttl: null, max: 2, force: false, pid: 2, retryCount: 0});
            assert.strictEqual(rA?.acquired, true, `wsA acquire failed: ${JSON.stringify(rA)}`);
            assert.strictEqual(rB?.acquired, true, `wsB acquire failed: ${JSON.stringify(rB)}`);
            assert.strictEqual(broker.locks.get(key).lockholders.size, 2, 'expected 2 holders after both acquires');

            const uC = uuidV4();
            const reply = unlockSync(broker, wsC, {type: 'unlock', uuid: uC, key, _uuid: 'WRONG-UUID', force: true});
            const remaining = broker.locks.get(key)?.lockholders?.size ?? 0;

            const reportedUnlocked = reply?.unlocked === true;
            const survivedHolders = remaining;
            console.log(`    reply.unlocked=${reportedUnlocked}, lockholders.size=${survivedHolders}`);
            if (reportedUnlocked && survivedHolders >= 2) {
                fail(`r1 PHANTOM-UNLOCK reproduced: reply.unlocked=true while ${survivedHolders} holders still in lockholders. reply=${JSON.stringify(reply)}`);
            }
            ok(`r1 OK: phantom-unlock prevented (reply=${JSON.stringify({unlocked: reply?.unlocked, error: reply?.error})}, holders=${survivedHolders})`);
        } finally {
            await new Promise<void>(r => broker.close(() => r()));
        }
    }

    // =============================================================
    // r2 — exclusive (max=1): wrong _uuid + force MUST NOT wipe valid holder
    // =============================================================
    console.log('\n[r2] exclusive (max=1): force-unlock with wrong _uuid must NOT evict the legitimate holder');
    {
        const broker = newBroker();
        try {
            const key = 'r2-excl';
            const wsA = new FakeSocket();
            const wsAttacker = new FakeSocket();
            broker.connectedClients.add(wsA);
            broker.connectedClients.add(wsAttacker);
            broker.wsToKeys.set(wsA, {});
            broker.wsToKeys.set(wsAttacker, {});
            broker.wsToUUIDs.set(wsA, {});
            broker.wsToUUIDs.set(wsAttacker, {});

            const uA = uuidV4();
            const rA = lockSync(broker, wsA, {type: 'lock', uuid: uA, key, ttl: null, max: 1, force: false, pid: 1, retryCount: 0});
            assert.strictEqual(rA?.acquired, true);
            assert.strictEqual(broker.locks.get(key).lockholders.size, 1);

            const reply = unlockSync(broker, wsAttacker, {type: 'unlock', uuid: uuidV4(), key, _uuid: 'WRONG-UUID', force: true});
            const remaining = broker.locks.get(key)?.lockholders?.size ?? 0;
            const aStillHolder = broker.locks.get(key)?.lockholders?.has(uA) ?? false;
            console.log(`    reply.unlocked=${reply?.unlocked}, lockholders.size=${remaining}, wsA still holder=${aStillHolder}`);
            if (remaining === 0 || !aStillHolder) {
                fail(`r2 OVER-EVICTION reproduced: attacker with wrong _uuid wiped legitimate holder. reply=${JSON.stringify(reply)}`);
            }
            ok(`r2 OK: legitimate holder survived attacker's wrong-_uuid force unlock`);
        } finally {
            await new Promise<void>(r => broker.close(() => r()));
        }
    }

    // =============================================================
    // r3 — cleanupConnection over-evicts a semaphore peer
    // =============================================================
    console.log('\n[r3] cleanupConnection on semaphore must only evict the closing client\'s holder, not peers');
    {
        const broker = newBroker();
        try {
            const key = 'r3-sem';
            const wsA = new FakeSocket();
            const wsB = new FakeSocket();
            broker.connectedClients.add(wsA);
            broker.connectedClients.add(wsB);
            broker.wsToKeys.set(wsA, {});
            broker.wsToKeys.set(wsB, {});
            broker.wsToUUIDs.set(wsA, {});
            broker.wsToUUIDs.set(wsB, {});

            const uA = uuidV4();
            const uB = uuidV4();
            const rA = lockSync(broker, wsA, {type: 'lock', uuid: uA, key, ttl: null, max: 2, force: false, pid: 1, retryCount: 0});
            const rB = lockSync(broker, wsB, {type: 'lock', uuid: uB, key, ttl: null, max: 2, force: false, pid: 2, retryCount: 0});
            assert.strictEqual(rA?.acquired, true);
            assert.strictEqual(rB?.acquired, true);
            assert.strictEqual(broker.locks.get(key).lockholders.size, 2);

            // wsA "disconnects" — broker's cleanupConnection runs.
            broker.cleanupConnection(wsA);
            const remaining = broker.locks.get(key)?.lockholders?.size ?? 0;
            const bStillHolder = broker.locks.get(key)?.lockholders?.has(uB) ?? false;
            console.log(`    after cleanup(wsA): lockholders.size=${remaining}, wsB still holder=${bStillHolder}`);
            if (remaining !== 1 || !bStillHolder) {
                fail(`r3 SEMAPHORE-COLLATERAL reproduced: cleanup of wsA evicted wsB. lockholders.size=${remaining}, B-holder=${bStillHolder}`);
            }
            ok(`r3 OK: peer wsB unaffected by wsA's disconnect; semaphore semantics preserved`);
        } finally {
            await new Promise<void>(r => broker.close(() => r()));
        }
    }

    // =============================================================
    // r4 — cleanupConnection notify-queue scrub: Object.keys(array)
    //      iterates string indices, not uuids. The closing client's
    //      queued waiter entries should be removed from `lck.notify`.
    // =============================================================
    console.log('\n[r4] cleanupConnection must remove the closing client\'s entries from lck.notify');
    {
        const broker = newBroker();
        try {
            const key = 'r4-busy';
            const wsHolder = new FakeSocket();
            const wsWaiter = new FakeSocket();
            broker.connectedClients.add(wsHolder);
            broker.connectedClients.add(wsWaiter);
            broker.wsToKeys.set(wsHolder, {});
            broker.wsToKeys.set(wsWaiter, {});
            broker.wsToUUIDs.set(wsHolder, {});
            broker.wsToUUIDs.set(wsWaiter, {});

            const uH = uuidV4();
            const uW = uuidV4();
            lockSync(broker, wsHolder, {type: 'lock', uuid: uH, key, ttl: null, max: 1, force: false, pid: 1, retryCount: 0});
            // wsWaiter's lock attempt enqueues since wsHolder owns it.
            lockSync(broker, wsWaiter, {type: 'lock', uuid: uW, key, ttl: null, max: 1, force: false, pid: 2, retryCount: 0});

            // Track the wsWaiter request in wsToUUIDs so cleanup tries to scrub it.
            broker.wsToUUIDs.get(wsWaiter)[uW] = true;

            const queueLenBefore = broker.locks.get(key)?.notify?.length ?? 0;
            console.log(`    notify.length before cleanup(wsWaiter)=${queueLenBefore}`);

            broker.cleanupConnection(wsWaiter);
            const queueLenAfter = broker.locks.get(key)?.notify?.length ?? 0;
            console.log(`    notify.length after cleanup(wsWaiter)=${queueLenAfter}`);

            if (queueLenBefore < 1) {
                fail(`r4 setup error: waiter never enqueued`);
            }
            if (queueLenAfter > 0) {
                fail(`r4 NOTIFY-SCRUB-INDICES-BUG reproduced: closing client's queued entry survived cleanup; notify.length=${queueLenAfter}`);
            }
            ok(`r4 OK: closing client's notify entry removed (notify went ${queueLenBefore} -> ${queueLenAfter})`);
        } finally {
            await new Promise<void>(r => broker.close(() => r()));
        }
    }

    clearTimeout(watchdog);
    console.log('\n\u2705 unlock-race-test: all 4 scenarios passed');
    process.exit(0);
}

main().catch(err => {
    console.error('unlock-race-test threw:', err);
    process.exit(1);
});
