'use strict';

/**
 * Regression suite for `acquire-many` queueing under contention.
 *
 * Before this fix, `Broker1.acquireMany` walked its sorted key list,
 * found the first contended key, sent `acquired:false`, and then
 * silently dropped the request — no entry on any notify queue. Any
 * caller that listened for the canonical "queued → granted" follow-up
 * (the Rust client and every cross-runtime client modeled after it)
 * waited forever.
 *
 * The fix queues the multi-key waiter on the contended key. When that
 * key frees up, `ensureNewLockHolder` dispatches into
 * `tryGrantAcquireManyFromQueue`, which atomically re-attempts the
 * whole composite, rolling back and re-queueing on a *different* key
 * if any other member is still taken.
 *
 * Each scenario below pokes the broker directly (no TCP) so the test
 * is fast and isolates the queue-state assertions from any client-side
 * logic.
 */

import * as assert from 'assert';
import {Broker1} from '../dist/main';
import {v4 as uuidV4} from 'uuid';

function fail(msg: string): never {
    console.error('\u274c FAIL:', msg);
    process.exit(1);
}

function ok(msg: string) {
    console.log('  \u2713', msg);
}

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: acquire-many-queueing-test took too long');
    process.exit(1);
}, 10_000);
watchdog.unref();

interface FakeSocket {
    label: string;
    writable: boolean;
    sent: any[];
    write(chunk: any): boolean;
    end(): void;
    destroy(): void;
    on(): void;
}

function makeSocket(label: string): FakeSocket {
    const sent: any[] = [];
    return {
        label,
        writable: true,
        sent,
        write(chunk: any): boolean {
            try {
                const lines = chunk.toString().trim().split('\n').filter(Boolean);
                for (const line of lines) sent.push(JSON.parse(line));
            } catch {
                // best-effort capture; tests below assert on the parsed shape
            }
            return true;
        },
        end() { /* noop */ },
        destroy() { /* noop */ },
        on() { /* noop */ },
    };
}

function tick(n = 4): Promise<void> {
    let p = Promise.resolve();
    for (let i = 0; i < n; i++) {
        p = p.then(() => new Promise<void>(r => setImmediate(r)));
    }
    return p;
}

function holderUuidForKey(broker: Broker1, key: string): string | null {
    const lck = broker.locks.get(key);
    if (!lck) return null;
    const it = lck.lockholders.keys().next();
    return it.done ? null : it.value;
}

async function newBroker(): Promise<Broker1> {
    const broker = new Broker1({port: 0, host: '127.0.0.1', noListen: true});
    // Swallow noisy "re-election" warnings — they're only meaningful when
    // a real client is supposed to ack and we're driving the broker
    // synchronously.
    broker.emitter.on('warning', () => { /* swallow */ });
    await broker.ensure();
    return broker;
}

async function s1_basic_queue_and_grant() {
    console.log('[s1] basic queue-on-contention then grant after release');
    const broker = await newBroker();
    const A = makeSocket('A');
    const B = makeSocket('B');

    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000}, A as any);
    if (!A.sent.find(m => m.type === 'lock' && m.acquired === true)) {
        fail('s1: A did not acquire k1');
    }

    broker.acquireMany({uuid: uuidV4(), keys: ['k1', 'k2', 'k3'], ttl: 60_000}, B as any);
    const bFirst = B.sent.find(m => m.type === 'acquire-many');
    assert.ok(bFirst, 's1: B got no acquire-many response');
    assert.strictEqual(bFirst.acquired, false, 's1: expected acquired:false');
    assert.strictEqual(bFirst.contendedKey, 'k1', 's1: expected contendedKey=k1');
    assert.ok(bFirst.lockRequestCount >= 1, 's1: expected lockRequestCount >= 1 after queueing');

    const aHolder = holderUuidForKey(broker, 'k1');
    assert.ok(aHolder, 's1: missing A holder');
    broker.unlock({uuid: uuidV4(), key: 'k1', _uuid: aHolder!}, A as any);
    await tick();

    const bSecond = B.sent.find(m => m !== bFirst && m.type === 'acquire-many' && m.acquired === true);
    assert.ok(bSecond, 's1: B did not get acquired:true after k1 released. frames=' + JSON.stringify(B.sent));
    assert.ok(bSecond.lockUuid, 's1: missing lockUuid on grant');
    assert.ok(bSecond.fencingTokens?.k1, 's1: missing fencing token for k1');
    assert.ok(bSecond.fencingTokens?.k2, 's1: missing fencing token for k2');
    assert.ok(bSecond.fencingTokens?.k3, 's1: missing fencing token for k3');
    ok('queued waiter receives acquired:true after the contended key frees');
}

async function s2_requeue_on_new_contention() {
    console.log('[s2] requeue on a new contended key when the first frees but another is still held');
    const broker = await newBroker();
    const A = makeSocket('A'), B = makeSocket('B'), C = makeSocket('C');

    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000}, A as any);
    broker.lock({uuid: uuidV4(), key: 'k2', ttl: 60_000}, C as any);
    broker.acquireMany({uuid: uuidV4(), keys: ['k1', 'k2'], ttl: 60_000}, B as any);

    const bFirst = B.sent.find(m => m.type === 'acquire-many');
    assert.ok(bFirst && bFirst.acquired === false && bFirst.contendedKey === 'k1', 's2: B not queued on k1');

    // Release k1 — broker should re-attempt; k2 still held → requeue on k2.
    const aHolder = holderUuidForKey(broker, 'k1')!;
    broker.unlock({uuid: uuidV4(), key: 'k1', _uuid: aHolder}, A as any);
    await tick();

    const bGrantedEarly = B.sent.find(m => m !== bFirst && m.type === 'acquire-many' && m.acquired === true);
    assert.ok(!bGrantedEarly, 's2: B granted prematurely while k2 still held');

    const k1lck = broker.locks.get('k1');
    assert.ok(k1lck, 's2: k1 lock object missing');
    assert.strictEqual(k1lck!.lockholders.size, 0, 's2: k1 should have no holders after rollback');

    const k2lck = broker.locks.get('k2');
    assert.ok(k2lck, 's2: k2 lock object missing');
    assert.strictEqual(k2lck!.notify.length, 1, 's2: B should be re-queued on k2');

    // Release k2 → composite grant.
    const cHolder = holderUuidForKey(broker, 'k2')!;
    broker.unlock({uuid: uuidV4(), key: 'k2', _uuid: cHolder}, C as any);
    await tick();

    const bGranted = B.sent.find(m => m !== bFirst && m.type === 'acquire-many' && m.acquired === true);
    assert.ok(bGranted, 's2: B did not grant after both keys freed');
    ok('rollback + requeue when the new contended key is different from the first');
}

async function s3_two_multi_key_competing() {
    console.log('[s3] two multi-key requests compete fairly (FIFO)');
    const broker = await newBroker();
    const A = makeSocket('A'), B = makeSocket('B'), C = makeSocket('C');

    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000}, A as any);
    broker.acquireMany({uuid: uuidV4(), keys: ['k1', 'k2'], ttl: 60_000}, B as any);
    broker.acquireMany({uuid: uuidV4(), keys: ['k1', 'k3'], ttl: 60_000}, C as any);

    const aHolder = holderUuidForKey(broker, 'k1')!;
    broker.unlock({uuid: uuidV4(), key: 'k1', _uuid: aHolder}, A as any);
    await tick();

    const bGranted = B.sent.find(m => m.type === 'acquire-many' && m.acquired === true);
    assert.ok(bGranted, 's3: B (first multi-key in queue) not granted');
    const cGrantedEarly = C.sent.find(m => m.type === 'acquire-many' && m.acquired === true);
    assert.ok(!cGrantedEarly, 's3: C granted out of order');

    broker.releaseMany({uuid: uuidV4(), lockUuid: bGranted.lockUuid}, B as any);
    await tick();

    const cGranted = C.sent.find(m => m.type === 'acquire-many' && m.acquired === true);
    assert.ok(cGranted, 's3: C did not grant after B release-many');
    ok('FIFO ordering between two competing acquire-many requests');
}

async function s4_single_key_ahead_of_multi_key() {
    console.log('[s4] single-key acquirer queued ahead of an acquire-many gets served first');
    const broker = await newBroker();
    const A = makeSocket('A'), B = makeSocket('B'), C = makeSocket('C');

    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000}, A as any);
    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000}, C as any);
    broker.acquireMany({uuid: uuidV4(), keys: ['k1', 'k2'], ttl: 60_000}, B as any);

    const k1lck = broker.locks.get('k1')!;
    assert.strictEqual(k1lck.notify.length, 2, 's4: queue length should be 2 on k1');

    const aHolder = holderUuidForKey(broker, 'k1')!;
    broker.unlock({uuid: uuidV4(), key: 'k1', _uuid: aHolder}, A as any);
    await tick();

    const cGranted = C.sent.find(m => m.type === 'lock' && m.acquired === true);
    assert.ok(cGranted, 's4: C did not get k1');
    const bEarly = B.sent.find(m => m.type === 'acquire-many' && m.acquired === true);
    assert.ok(!bEarly, 's4: B granted out of order');

    const cHolder = holderUuidForKey(broker, 'k1')!;
    broker.unlock({uuid: uuidV4(), key: 'k1', _uuid: cHolder}, C as any);
    await tick();

    const bGranted = B.sent.find(m => m.type === 'acquire-many' && m.acquired === true);
    assert.ok(bGranted, 's4: B did not grant after C released');
    ok('single-key + multi-key on the same queue both make progress in order');
}

async function s5_release_many_wakes_queued_acquire_many() {
    console.log('[s5] release-many on a held composite wakes a queued multi-key waiter');
    const broker = await newBroker();
    const A = makeSocket('A'), B = makeSocket('B');

    // A: composite over [k1, k2]
    broker.acquireMany({uuid: uuidV4(), keys: ['k1', 'k2'], ttl: 60_000}, A as any);
    const aGranted = A.sent.find(m => m.type === 'acquire-many' && m.acquired === true);
    assert.ok(aGranted, 's5: A did not get composite');

    // B: composite over [k2, k3] — k2 is contended.
    broker.acquireMany({uuid: uuidV4(), keys: ['k2', 'k3'], ttl: 60_000}, B as any);
    const bFirst = B.sent.find(m => m.type === 'acquire-many');
    assert.ok(bFirst && bFirst.acquired === false, 's5: B not queued');

    broker.releaseMany({uuid: uuidV4(), lockUuid: aGranted.lockUuid}, A as any);
    await tick();

    const bGranted = B.sent.find(m => m !== bFirst && m.type === 'acquire-many' && m.acquired === true);
    assert.ok(bGranted, 's5: B did not grant after A release-many');
    ok('release-many drives queued multi-key waiter to acquired:true');
}

async function s6_idempotent_reenqueue() {
    console.log('[s6] re-sending the same acquire-many uuid does not double-enqueue');
    const broker = await newBroker();
    const A = makeSocket('A'), B = makeSocket('B');
    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000}, A as any);

    const bUuid = uuidV4();
    broker.acquireMany({uuid: bUuid, keys: ['k1', 'k2'], ttl: 60_000}, B as any);
    broker.acquireMany({uuid: bUuid, keys: ['k1', 'k2'], ttl: 60_000}, B as any);

    const k1lck = broker.locks.get('k1')!;
    assert.strictEqual(k1lck.notify.length, 1, 's6: duplicate enqueue detected');
    ok('no duplicate notify entry on re-send');
}

(async () => {
    try {
        console.log('acquire-many queueing regression suite');
        await s1_basic_queue_and_grant();
        await s2_requeue_on_new_contention();
        await s3_two_multi_key_competing();
        await s4_single_key_ahead_of_multi_key();
        await s5_release_many_wakes_queued_acquire_many();
        await s6_idempotent_reenqueue();
        console.log('\n\u2705 all acquire-many queueing scenarios passed');
        clearTimeout(watchdog);
        process.exit(0);
    } catch (err: any) {
        console.error('\n\u274c FAIL:', err && err.stack || err);
        process.exit(1);
    }
})();
