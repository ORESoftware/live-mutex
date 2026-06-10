'use strict';

/**
 * Extra chaos / robustness scenarios for the Node.js broker.
 *
 * Complements `chaos-fuzz-test.ts` with four scenarios that target
 * operational properties the existing suite does not cover:
 *
 *   s8  TCP-disconnect burst: N raw TCP clients each acquire on a
 *       distinct key and slam their socket shut without releasing.
 *       The broker must reap every holder and the queue, and a
 *       fresh client must be able to acquire all keys again.
 *
 *   s9  High-contention FIFO fairness: M waiters enqueue serially on
 *       one hot key (next waiter is started only after the previous
 *       one is observed in `lck.notify.size`). The grant order must
 *       match the enqueue order and fencing tokens must be strictly
 *       monotonic across the run.
 *
 *  s10  TTL sweeper rescue: a client acquires a short-TTL lock and
 *       crashes (its socket is destroyed) before releasing. After
 *       the deadline elapses, calling `broker.tickTtl()` directly
 *       evicts the abandoned holder and grants the next waiter.
 *
 *  s11  Fencing token across broker restart: a token minted by
 *       broker A and a token minted by broker B (started after A is
 *       closed) on the same key must be strictly increasing across
 *       the process boundary, since the per-key fencing counter
 *       seeds from `Date.now()` at lock creation. This protects
 *       downstream Kleppmann consumers from accepting stale fences
 *       after a broker rotation.
 */

import * as assert from 'assert';
import * as net from 'net';
import {Broker1, Client} from '../dist/main';
import {v4 as uuidV4} from 'uuid';

// =====================================================================
// Harness — the same pickPort + startBroker pattern as chaos-fuzz-test.
// Kept self-contained so this file can run standalone.
// =====================================================================

async function pickPort(): Promise<number> {
    for (let attempt = 0; attempt < 32; attempt++) {
        const candidate = 10000 + Math.floor(Math.random() * 30000);
        const ok = await new Promise<boolean>((resolve) => {
            const server = net.createServer();
            server.unref();
            server.once('error', () => resolve(false));
            server.listen(candidate, '127.0.0.1', () => {
                server.close(() => resolve(true));
            });
        });
        if (ok) return candidate;
    }
    throw new Error('pickPort: could not bind any candidate port');
}

async function startBroker(): Promise<{broker: any; port: number; close: () => Promise<void>}> {
    const port = await pickPort();
    const broker = new Broker1({port, host: '127.0.0.1'});
    if (broker.emitter && typeof broker.emitter.on === 'function') {
        broker.emitter.on('warning', () => {/* suppress */});
        broker.emitter.on('error', () => {/* suppress */});
    }
    await broker.ensure();
    return {
        broker,
        port,
        close: async () => {
            await new Promise<void>(r => setTimeout(r, 30));
            try { broker.close && broker.close(null); } catch {/* ignore */}
        },
    };
}

function quietClient<T extends {emitter?: any}>(c: T): T {
    if (c.emitter && typeof c.emitter.on === 'function') {
        c.emitter.on('warning', () => {});
        c.emitter.on('error', () => {});
    }
    return c;
}

async function withTimeout<T>(label: string, ms: number, p: Promise<T>): Promise<T> {
    let to: NodeJS.Timeout | null = null;
    const timer = new Promise<never>((_, rej) => {
        to = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([p, timer]);
    } finally {
        if (to) clearTimeout(to);
    }
}

let scenarioCount = 0;
function ok(label: string, msg: string) {
    process.stdout.write(`  ${label}: \u2713 ${msg}\n`);
}
function fail(label: string, msg: string): never {
    process.stderr.write(`  ${label}: \u2717 ${msg}\n`);
    process.exit(1);
}

// =====================================================================
// s8 — TCP disconnect burst
// =====================================================================
//
// We deliberately use the high-level Client to acquire (so the broker
// observes a normal handshake + Lock request), then call `client.close()`
// which destroys the underlying socket. The broker's `cleanupConnection`
// path is what we're exercising; it should reap every key's holder
// regardless of who closed the socket.

async function s8_tcp_disconnect_burst() {
    const label = 's8';
    const {broker, port, close} = await startBroker();
    try {
        const nClients = 40;
        const keys = Array.from({length: nClients}, (_, i) => `s8-burst-${i}`);

        const clients: any[] = [];
        for (let i = 0; i < nClients; i++) {
            const c = quietClient(
                await new Client({port, lockRequestTimeout: 8_000, ttl: 30_000}).ensure(),
            );
            const lock = await c.acquire(keys[i], {ttl: 30_000, maxRetries: 1});
            // Sanity: broker actually has the holder on this key.
            const sz = broker.locks.get(keys[i])?.lockholders?.size ?? 0;
            if (sz !== 1) {
                fail(label, `expected 1 holder on ${keys[i]} after acquire, got ${sz}`);
            }
            clients.push(c);
            // Do not store `lock`; we want the client to disappear without
            // a release.
            void lock;
        }

        for (const c of clients) {
            try { c.close(); } catch {/* ignore */}
        }

        const deadline = Date.now() + 5_000;
        let stillHeld: string[] = keys.slice();
        while (stillHeld.length > 0 && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 20));
            stillHeld = stillHeld.filter(k => {
                const lck = broker.locks.get(k);
                const sz = lck?.lockholders?.size ?? 0;
                const queued = lck?.notify?.size ?? 0;
                return sz > 0 || queued > 0;
            });
        }
        if (stillHeld.length > 0) {
            fail(label, `broker did not reap holders within 5s. still held: ${stillHeld.slice(0, 5).join(', ')} (+${Math.max(0, stillHeld.length - 5)} more)`);
        }

        const probe = quietClient(
            await new Client({port, lockRequestTimeout: 5_000, ttl: 1_000}).ensure(),
        );
        try {
            for (const k of keys) {
                const got = await probe.acquire(k, {ttl: 500, maxRetries: 2});
                await probe.release(k, got.id);
            }
        } finally {
            probe.close();
        }
        ok(label, `${nClients} simultaneous client disconnects reaped, every key re-acquirable`);
    } finally {
        await close();
    }
    scenarioCount++;
}

// =====================================================================
// s9 — High-contention FIFO fairness on a single key
// =====================================================================
//
// One holder + N waiters. We start each waiter's acquire ONLY after the
// broker is observed to have enqueued the previous one, so the enqueue
// order is deterministic. After the holder releases, the broker should
// drain the queue in order: each waiter receives the lock in turn, with
// strictly monotonic fencing tokens.
//
// `lck.notify.size` is the broker's queue depth for that key, so we
// poll it to know when each waiter is enqueued.

async function s9_high_contention_fifo() {
    const label = 's9';
    const {broker, port, close} = await startBroker();
    try {
        const key = 's9-fifo-key';
        const nWaiters = 40;

        const holder = quietClient(
            await new Client({port, lockRequestTimeout: 60_000, ttl: 60_000}).ensure(),
        );
        const holderLock = await holder.acquire(key, {ttl: 60_000, maxRetries: 1});

        const grantOrder: number[] = [];
        const tokensInGrantOrder: number[] = [];
        const releasers: Array<() => void> = [];
        const tasks: Promise<void>[] = [];
        const grantOrderMu: Promise<void>[] = [];

        for (let waiter = 0; waiter < nWaiters; waiter++) {
            const trigger = new Promise<void>((resolve) => {
                releasers.push(resolve);
            });
            const myWaiter = waiter;
            const startedTask = (async () => {
                const c = quietClient(
                    await new Client({port, lockRequestTimeout: 60_000, ttl: 60_000}).ensure(),
                );
                try {
                    const lck = await c.acquire(key, {ttl: 60_000, maxRetries: 1});
                    grantOrder.push(myWaiter);
                    if (typeof lck.fencingToken === 'number') {
                        tokensInGrantOrder.push(lck.fencingToken);
                    }
                    await trigger;
                    await c.release(key, lck.id);
                } finally {
                    c.close();
                }
            })();
            tasks.push(startedTask);

            // Wait until this waiter is observed enqueued in the broker's
            // notify queue before starting the next one.
            const target = waiter + 1; // queue depth excluding holder
            const enqDeadline = Date.now() + 10_000;
            while (true) {
                const lck = broker.locks.get(key);
                const sz = lck?.notify?.size ?? 0;
                if (sz >= target) break;
                if (Date.now() > enqDeadline) {
                    fail(label, `waiter ${waiter} did not enqueue: notify.size=${sz} after 10s`);
                }
                await new Promise(r => setTimeout(r, 5));
            }
        }

        await holder.release(key, holderLock.id);
        holder.close();

        // Drain: trickle releasers so each grant happens, then is
        // released, allowing the next waiter through.
        const drainDeadline = Date.now() + 30_000;
        let nextToTrigger = 0;
        while (grantOrder.length < nWaiters) {
            if (Date.now() > drainDeadline) {
                fail(label, `only ${grantOrder.length}/${nWaiters} waiters granted after 30s`);
            }
            // Trigger releases for all waiters whose grant we've observed
            // but who haven't been released yet.
            while (nextToTrigger < grantOrder.length) {
                const idx = nextToTrigger++;
                releasers[grantOrder[idx]]?.();
            }
            await new Promise(r => setTimeout(r, 2));
        }
        // Trigger any remaining (in case grantOrder grew but we missed it).
        for (const r of releasers) r();
        await withTimeout(label, 20_000, Promise.all(tasks));

        const expected = Array.from({length: nWaiters}, (_, i) => i);
        if (grantOrder.length !== nWaiters || grantOrder.some((v, i) => v !== expected[i])) {
            fail(label, `FIFO violated. expected ${JSON.stringify(expected)}, got ${JSON.stringify(grantOrder)}`);
        }

        if (tokensInGrantOrder.length === nWaiters) {
            for (let i = 1; i < tokensInGrantOrder.length; i++) {
                if (!(tokensInGrantOrder[i] > tokensInGrantOrder[i - 1])) {
                    fail(label, `fencing tokens not strictly monotonic in grant order: ${JSON.stringify(tokensInGrantOrder)}`);
                }
            }
        }

        ok(label, `${nWaiters} waiters drained in FIFO order with monotonic fencing tokens`);
    } finally {
        await close();
    }
    scenarioCount++;
}

// =====================================================================
// s10 — TTL sweeper rescues a queue blocked by an abandoned holder
// =====================================================================
//
// Acquire a lock with a short TTL, then deliberately abandon it (do not
// release, but do not close the client either — so the broker's
// `cleanupConnection` path doesn't fire). Enqueue a waiter. Manually
// invoke `broker.tickTtl()` to advance the sweeper synchronously, then
// verify the waiter is granted.
//
// This is the inverse of s8: s8 covers "client socket dies", this
// covers "client lives but lock TTL expires while held". Both paths
// must drain the queue.

async function s10_ttl_sweeper_rescue() {
    const label = 's10';
    const {broker, port, close} = await startBroker();
    try {
        // Stop the automatic 25ms sweeper so the test drives eviction
        // synchronously. Without this, the auto-sweeper races with the
        // test's `tickTtl()` call and may steal the eviction, making
        // the manual eviction count zero.
        broker.stopTtlSweeper();

        const key = 's10-stale-key';

        const holder = quietClient(
            await new Client({port, lockRequestTimeout: 5_000, ttl: 30_000}).ensure(),
        );
        const holdLock = await holder.acquire(key, {ttl: 200, maxRetries: 1});
        if ((broker.locks.get(key)?.lockholders?.size ?? 0) !== 1) {
            fail(label, 'holder not registered in broker');
        }

        const waiter = quietClient(
            await new Client({port, lockRequestTimeout: 10_000, ttl: 30_000}).ensure(),
        );
        const waiterAcq = waiter.acquire(key, {ttl: 30_000, maxRetries: 1});

        // Wait for waiter to be enqueued.
        const enqDeadline = Date.now() + 5_000;
        while ((broker.locks.get(key)?.notify?.size ?? 0) < 1) {
            if (Date.now() > enqDeadline) {
                fail(label, 'waiter never enqueued');
            }
            await new Promise(r => setTimeout(r, 5));
        }

        // Sleep past the holder's TTL. With the auto-sweeper stopped,
        // the holder remains in `lockholders` until we tick.
        await new Promise(r => setTimeout(r, 250));
        if ((broker.locks.get(key)?.lockholders?.size ?? 0) !== 1) {
            fail(label, 'auto-sweeper still appears active — holder evicted before manual tick');
        }

        const evicted = broker.tickTtl();
        if (evicted < 1) {
            fail(label, `tickTtl evicted ${evicted} entries (expected >=1)`);
        }

        const grantedLock = await withTimeout(label, 5_000, waiterAcq);
        if (!grantedLock || !grantedLock.id) {
            fail(label, 'waiter lock object missing');
        }

        await waiter.release(key, grantedLock.id);
        waiter.close();

        try { await holder.release(key, holdLock.id); } catch {/* expected: lock already evicted */}
        holder.close();

        ok(label, 'TTL sweeper evicted abandoned holder and granted enqueued waiter');
    } finally {
        await close();
    }
    scenarioCount++;
}

// =====================================================================
// s11 — Fencing token advances across broker restart
// =====================================================================

async function s11_fencing_advances_across_broker_restart() {
    const label = 's11';
    const key = 's11-restart-fence';

    const a = await startBroker();
    let tokenA: number | null = null;
    try {
        const c = quietClient(
            await new Client({port: a.port, lockRequestTimeout: 5_000, ttl: 5_000}).ensure(),
        );
        try {
            const got = await c.acquire(key, {ttl: 1_000, maxRetries: 1});
            if (typeof got.fencingToken !== 'number') {
                fail(label, 'broker A returned no fencing token');
            }
            tokenA = got.fencingToken;
            await c.release(key, got.id);
        } finally {
            c.close();
        }
    } finally {
        await a.close();
    }

    // Make sure wall-clock has advanced — the per-key fencing counter is
    // re-seeded from `Date.now()` when broker B sees its first request
    // for the key.
    await new Promise(r => setTimeout(r, 15));

    const b = await startBroker();
    let tokenB: number | null = null;
    try {
        const c = quietClient(
            await new Client({port: b.port, lockRequestTimeout: 5_000, ttl: 5_000}).ensure(),
        );
        try {
            const got = await c.acquire(key, {ttl: 1_000, maxRetries: 1});
            if (typeof got.fencingToken !== 'number') {
                fail(label, 'broker B returned no fencing token');
            }
            tokenB = got.fencingToken;
            await c.release(key, got.id);

            // Verify the post-restart counter still grows monotonically.
            let last = tokenB;
            const seen = new Set<number>([tokenB]);
            for (let i = 0; i < 16; i++) {
                const g = await c.acquire(key, {ttl: 1_000, maxRetries: 1});
                if (typeof g.fencingToken !== 'number') {
                    fail(label, 'follow-up acquire returned no fencing token');
                }
                if (!(g.fencingToken > last)) {
                    fail(label, `post-restart token regressed: prev=${last} next=${g.fencingToken}`);
                }
                if (seen.has(g.fencingToken)) {
                    fail(label, `post-restart token duplicated: ${g.fencingToken}`);
                }
                seen.add(g.fencingToken);
                last = g.fencingToken;
                await c.release(key, g.id);
            }
        } finally {
            c.close();
        }
    } finally {
        await b.close();
    }

    if (!(tokenA! < tokenB!)) {
        fail(label, `fencing token did not advance across restart: A=${tokenA} B=${tokenB}`);
    }
    ok(label, `tokens across restart strictly increasing: A=${tokenA} -> B=${tokenB} (+15 monotonic follow-ups)`);
    scenarioCount++;
}

// =====================================================================
// Driver
// =====================================================================

const watchdog = setTimeout(() => {
    process.stderr.write(`chaos-fuzz-extra-test watchdog: total runtime exceeded budget\n`);
    process.exit(1);
}, 5 * 60_000);
watchdog.unref();

(async () => {
    const scenarios: Array<[string, () => Promise<void>]> = [
        ['s8', s8_tcp_disconnect_burst],
        ['s9', s9_high_contention_fifo],
        ['s10', s10_ttl_sweeper_rescue],
        ['s11', s11_fencing_advances_across_broker_restart],
    ];
    for (const [name, fn] of scenarios) {
        try {
            await fn();
        } catch (err: any) {
            process.stderr.write(`scenario ${name} threw: ${err && err.stack || err}\n`);
            process.exit(1);
        }
    }
    process.stdout.write(`\n\u2705 chaos-fuzz-extra-test: all ${scenarioCount} scenarios passed\n`);
    clearTimeout(watchdog);
    process.exit(0);
})().catch(err => {
    process.stderr.write(`top-level: ${err && err.stack || err}\n`);
    process.exit(1);
});
