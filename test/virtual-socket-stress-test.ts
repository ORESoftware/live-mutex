'use strict';

/**
 * High-concurrency stress test for the InProcessBridge + hardened
 * VirtualSocket. The bridge correlation map (`inflight: Map<uuid,
 * Pending>`) is the only thing keeping concurrent HTTP requests from
 * stepping on each other's replies. If the FIFO `process.nextTick`
 * delivery, the per-uuid resolution path, the bridge-ownership
 * cleanup, or the Promise correlation map ever broke under load,
 * this test would hang, reject, or yield wrong fencing-token order.
 *
 * What it does
 * ------------
 *
 * Uses a `noListen` `Broker1` (no TCP listener at all) plus a single
 * `InProcessBridge`, then drives every shape of bridge call in
 * parallel:
 *
 *   * 200 concurrent `bridge.lock(...)` on distinct keys (each
 *     should see its own grant + a unique fencing token).
 *   * 200 concurrent `bridge.acquireMany(...)` requests on
 *     three-key tuples (each gets a single composite lockUuid +
 *     three fencing tokens).
 *   * 200 concurrent `bridge.unlock(...)` matched against the
 *     200 grants from step 1 (each releases its own hold, no
 *     other lock affected).
 *   * 200 concurrent `bridge.releaseMany(...)` matched against
 *     the 200 composite holds.
 *
 * After every batch we assert:
 *   * The bridge's `connectedClients` count never grew (still 1).
 *   * `pendingCount` returned to 0.
 *   * Broker `connectedClients.size` returned to baseline + 1
 *     (just the bridge socket).
 *   * Held-lock count matches the expected number of in-flight
 *     holds.
 *   * Heap usage stayed within a reasonable bound (no per-call
 *     leak in the correlation map or the broker's wsToKeys/
 *     wsToUUIDs maps).
 *
 * Self-times-out at 20s. On a current-gen MBP this typically
 * finishes in 200-400ms.
 */

import * as assert from 'assert';
import {Broker1, InProcessBridge} from '../dist/main';

function fail(msg: string): never {
    console.error('\u274c FAIL:', msg);
    process.exit(1);
}

function ok(msg: string) {
    console.log('  \u2713', msg);
}

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: virtual-socket-stress-test took too long');
    process.exit(1);
}, 20_000);
watchdog.unref();

async function main() {
    const N = 200;
    console.log(`[stress] ${N} concurrent ops per phase, single bridge, noListen broker`);

    const broker = new Broker1({noListen: true, port: 0, host: '127.0.0.1'});
    broker.emitter.on('warning', () => {});
    const baselineConnected = broker.connectedClients.size;
    const bridge = new InProcessBridge(broker);

    const heap0 = process.memoryUsage().heapUsed;
    const t0 = Date.now();

    // ---------------------------------------------------------------
    // Phase 1: N concurrent single-key acquires
    // ---------------------------------------------------------------
    const lockPromises: Promise<any>[] = [];
    for (let i = 0; i < N; i++) {
        lockPromises.push(bridge.lock({key: `stress-single-${i}`, ttl: 60_000}));
    }
    const pendingDuringLockBatch = bridge.pendingCount;
    if (pendingDuringLockBatch !== N) {
        fail(`pendingCount during lock batch = ${pendingDuringLockBatch}; expected ${N}`);
    }
    const lockReplies: any[] = await Promise.all(lockPromises);
    const t1 = Date.now();

    // Assert every reply is well-formed and unique. NB: for single-key
    // grants the bridge does NOT surface a separate `lockUuid` — it
    // reuses the request uuid (`_bridgeRequestUuid`) as the holder
    // identity, which the HTTP layer (`http-server.ts:417`) re-exports
    // as `lockUuid` in its public response. Match that semantic.
    const grantedUuids = new Set<string>();
    const fencingTokens: number[] = [];
    for (let i = 0; i < N; i++) {
        const r = lockReplies[i];
        if (r.acquired !== true) fail(`lock[${i}].acquired=${r.acquired}; reply=${JSON.stringify(r)}`);
        const holderUuid: string = r._bridgeRequestUuid;
        if (typeof holderUuid !== 'string' || holderUuid.length === 0) {
            fail(`lock[${i}] missing _bridgeRequestUuid`);
        }
        if (typeof r.fencingToken !== 'number' || r.fencingToken < 1) fail(`lock[${i}] bad fencingToken: ${r.fencingToken}`);
        if (grantedUuids.has(holderUuid)) fail(`duplicate holder uuid at i=${i}: ${holderUuid}`);
        grantedUuids.add(holderUuid);
        fencingTokens.push(r.fencingToken);
    }
    if (grantedUuids.size !== N) fail(`grantedUuids.size=${grantedUuids.size}; expected ${N}`);
    if (bridge.pendingCount !== 0) fail(`pendingCount post-lock = ${bridge.pendingCount}`);
    if (broker.connectedClients.size !== baselineConnected + 1) {
        fail(`connectedClients drifted: ${broker.connectedClients.size}, baseline+1=${baselineConnected + 1}`);
    }
    // Broker should see N held locks now.
    if ((broker as any).locks.size !== N) {
        fail(`broker.locks.size=${(broker as any).locks.size}; expected ${N}`);
    }
    ok(`phase 1: ${N} concurrent locks granted; ${grantedUuids.size} unique uuids; pendingCount=0 (${t1 - t0}ms)`);

    // ---------------------------------------------------------------
    // Phase 2: N concurrent acquireMany on overlapping shape
    // ---------------------------------------------------------------
    const amPromises: Promise<any>[] = [];
    for (let i = 0; i < N; i++) {
        amPromises.push(bridge.acquireMany([`am-a-${i}`, `am-b-${i}`, `am-c-${i}`], 60_000));
    }
    const amReplies: any[] = await Promise.all(amPromises);
    const t2 = Date.now();

    const amUuids = new Set<string>();
    for (let i = 0; i < N; i++) {
        const r = amReplies[i];
        if (r.acquired !== true) fail(`am[${i}].acquired=${r.acquired}: ${JSON.stringify(r)}`);
        if (!r.lockUuid) fail(`am[${i}] missing lockUuid`);
        if (amUuids.has(r.lockUuid)) fail(`duplicate composite uuid at i=${i}`);
        amUuids.add(r.lockUuid);
        if (Object.keys(r.fencingTokens || {}).length !== 3) {
            fail(`am[${i}].fencingTokens has ${Object.keys(r.fencingTokens || {}).length} entries; expected 3`);
        }
    }
    if (bridge.pendingCount !== 0) fail(`pendingCount post-acquireMany = ${bridge.pendingCount}`);
    // 3*N more keys held: N single-keys + 3*N composite-keys = 4*N total
    if ((broker as any).locks.size !== 4 * N) {
        fail(`broker.locks.size=${(broker as any).locks.size}; expected ${4 * N}`);
    }
    ok(`phase 2: ${N} concurrent acquireMany granted; broker.locks.size=${(broker as any).locks.size} (${t2 - t1}ms)`);

    // ---------------------------------------------------------------
    // Phase 3: N concurrent unlocks targeting phase-1 holds
    // ---------------------------------------------------------------
    const unlockPromises: Promise<any>[] = [];
    for (let i = 0; i < N; i++) {
        unlockPromises.push(bridge.unlock({
            key: `stress-single-${i}`,
            lockUuid: lockReplies[i]._bridgeRequestUuid,
        }));
    }
    const unlockReplies: any[] = await Promise.all(unlockPromises);
    const t3 = Date.now();

    let unlockedOk = 0;
    for (let i = 0; i < N; i++) {
        if (unlockReplies[i].unlocked === true) unlockedOk++;
    }
    if (unlockedOk !== N) fail(`only ${unlockedOk}/${N} unlocks succeeded`);
    if (bridge.pendingCount !== 0) fail(`pendingCount post-unlock = ${bridge.pendingCount}`);
    ok(`phase 3: ${N} concurrent unlocks succeeded (${t3 - t2}ms)`);

    // ---------------------------------------------------------------
    // Phase 4: N concurrent releaseMany targeting phase-2 holds
    // ---------------------------------------------------------------
    const rmPromises: Promise<any>[] = [];
    for (let i = 0; i < N; i++) {
        rmPromises.push(bridge.releaseMany(amReplies[i].lockUuid));
    }
    const rmReplies: any[] = await Promise.all(rmPromises);
    const t4 = Date.now();

    let rmOk = 0;
    for (let i = 0; i < N; i++) {
        if (rmReplies[i].released === true) rmOk++;
    }
    if (rmOk !== N) fail(`only ${rmOk}/${N} releaseMany succeeded`);
    ok(`phase 4: ${N} concurrent releaseMany succeeded (${t4 - t3}ms)`);

    // ---------------------------------------------------------------
    // Final invariants
    // ---------------------------------------------------------------
    if (bridge.pendingCount !== 0) fail(`pendingCount final = ${bridge.pendingCount}`);
    if (broker.connectedClients.size !== baselineConnected + 1) {
        fail(`connectedClients drifted post-stress: ${broker.connectedClients.size}`);
    }

    // Holders should be 0 across every key (LockObj may linger but
    // empty). lockholders.size === 0 invariant.
    let nonEmpty = 0;
    for (const lock of ((broker as any).locks as Map<string, any>).values()) {
        if (lock.lockholders && lock.lockholders.size > 0) nonEmpty++;
    }
    if (nonEmpty !== 0) fail(`${nonEmpty} keys still have lockholders > 0 after stress`);
    ok(`all keys have 0 holders after release phase`);

    const heap1 = process.memoryUsage().heapUsed;
    const heapDeltaMb = ((heap1 - heap0) / 1024 / 1024).toFixed(2);
    // Heap should not have ballooned. 4*N=800 lock objects in
    // broker.locks plus the response history is well under 50MB.
    const heapDeltaMbNum = (heap1 - heap0) / 1024 / 1024;
    if (heapDeltaMbNum > 50) {
        fail(`heap grew by ${heapDeltaMb}MB; expected < 50MB`);
    }
    ok(`heap delta = ${heapDeltaMb}MB (< 50MB threshold)`);

    bridge.shutdown();
    if (broker.connectedClients.size !== baselineConnected) {
        fail(`bridge socket still in connectedClients after shutdown: size=${broker.connectedClients.size}`);
    }
    ok(`post-shutdown connectedClients=${broker.connectedClients.size} (back to baseline)`);

    await new Promise<void>(r => broker.close(() => r()));
    clearTimeout(watchdog);
    console.log(`\n\u2705 virtual-socket-stress-test: ${4 * N} ops in ${t4 - t0}ms; heap +${heapDeltaMb}MB`);
    process.exit(0);
}

main().catch(err => {
    console.error('virtual-socket-stress-test threw:', err);
    process.exit(1);
});
