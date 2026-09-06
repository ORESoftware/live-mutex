'use strict';

/**
 * Caller-controlled wait / no-wait for `lock` and `acquire-many`.
 *
 * `wait:false` (try-lock) makes a contended request fail fast — the broker
 * replies `acquired:false` immediately and DOES NOT enqueue the waiter, so it
 * can never leak a deferred grant. This is the symmetric counterpart to the
 * default `wait:true`, which queues the waiter and later emits `acquired:true`
 * (see acquire-many-queueing-test.ts).
 *
 * Each scenario pokes the broker directly (no TCP) and asserts on both the
 * emitted frames and the internal notify-queue state.
 */

import * as assert from 'assert';
import {Broker1} from '../dist/main';
import {v4 as uuidV4} from 'uuid';

function ok(msg: string) {
    console.log('  \u2713', msg);
}

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: acquire-many-wait-flag-test took too long');
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
                // best-effort capture
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
    broker.emitter.on('warning', () => { /* swallow */ });
    await broker.ensure();
    return broker;
}

async function nw1_single_key_no_wait_does_not_enqueue() {
    console.log('[nw1] single-key wait:false fails fast and does not enqueue');
    const broker = await newBroker();
    const A = makeSocket('A'), B = makeSocket('B');

    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000}, A as any);
    assert.ok(A.sent.find(m => m.type === 'lock' && m.acquired === true), 'nw1: A did not acquire k1');

    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000, wait: false}, B as any);
    const bReply = B.sent.find(m => m.type === 'lock');
    assert.ok(bReply, 'nw1: B got no lock reply');
    assert.strictEqual(bReply.acquired, false, 'nw1: B no-wait should be acquired:false');

    const k1 = broker.locks.get('k1')!;
    assert.strictEqual(k1.notify.length, 0, 'nw1: no-wait must NOT enqueue a waiter');

    // Release A. Because B was never queued, B must not receive a grant.
    const aHolder = holderUuidForKey(broker, 'k1')!;
    broker.unlock({uuid: uuidV4(), key: 'k1', _uuid: aHolder}, A as any);
    await tick();
    const bGrant = B.sent.find(m => m !== bReply && m.type === 'lock' && m.acquired === true);
    assert.ok(!bGrant, 'nw1: no-wait B must not receive a deferred grant');

    // A fresh no-wait acquire now succeeds since k1 is free and unqueued.
    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000, wait: false}, B as any);
    const bSecond = B.sent.reverse().find(m => m.type === 'lock');
    assert.ok(bSecond && bSecond.acquired === true, 'nw1: no-wait retry should succeed once free');
    ok('single-key no-wait: fail-fast, no enqueue, clean retry after release');
}

async function nw2_composite_no_wait_fails_fast_and_rolls_back() {
    console.log('[nw2] composite wait:false fails fast, does not enqueue, no partial lock');
    const broker = await newBroker();
    const A = makeSocket('A'), B = makeSocket('B'), C = makeSocket('C');

    // A holds k1.
    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000}, A as any);

    // B no-wait composite [k1, k2] — k1 contended → immediate acquired:false.
    broker.acquireMany({uuid: uuidV4(), keys: ['k1', 'k2'], ttl: 60_000, wait: false}, B as any);
    const bReply = B.sent.find(m => m.type === 'acquire-many');
    assert.ok(bReply, 'nw2: B got no acquire-many reply');
    assert.strictEqual(bReply.acquired, false, 'nw2: B no-wait composite should be acquired:false');
    assert.strictEqual(bReply.contendedKey, 'k1', 'nw2: expected contendedKey=k1');

    // No waiter enqueued on the contended key.
    const k1 = broker.locks.get('k1')!;
    assert.strictEqual(k1.notify.length, 0, 'nw2: no-wait composite must NOT enqueue');

    // The free member k2 must not be partially locked by the rolled-back try.
    const k2 = broker.locks.get('k2');
    assert.ok(!k2 || k2.lockholders.size === 0, 'nw2: k2 must not be partially locked');
    broker.lock({uuid: uuidV4(), key: 'k2', ttl: 60_000, wait: false}, C as any);
    assert.ok(C.sent.find(m => m.type === 'lock' && m.acquired === true), 'nw2: k2 should be grabbable');
    ok('composite no-wait: fail-fast, no enqueue, free members rolled back');
}

async function nw3_wait_true_still_queues_and_grants() {
    console.log('[nw3] wait:true (default) still queues a contended composite and grants on release');
    const broker = await newBroker();
    const A = makeSocket('A'), B = makeSocket('B');

    broker.lock({uuid: uuidV4(), key: 'k1', ttl: 60_000}, A as any);
    broker.acquireMany({uuid: uuidV4(), keys: ['k1', 'k2'], ttl: 60_000, wait: true}, B as any);

    const bFirst = B.sent.find(m => m.type === 'acquire-many');
    assert.ok(bFirst && bFirst.acquired === false, 'nw3: B not queued');
    const k1 = broker.locks.get('k1')!;
    assert.strictEqual(k1.notify.length, 1, 'nw3: wait:true must enqueue');

    const aHolder = holderUuidForKey(broker, 'k1')!;
    broker.unlock({uuid: uuidV4(), key: 'k1', _uuid: aHolder}, A as any);
    await tick();
    const bGrant = B.sent.find(m => m !== bFirst && m.type === 'acquire-many' && m.acquired === true);
    assert.ok(bGrant, 'nw3: waiting B did not grant after release');
    ok('wait:true preserves the historical queue-then-grant behavior');
}

async function nw4_composite_no_wait_succeeds_when_free() {
    console.log('[nw4] composite wait:false succeeds immediately when all keys are free');
    const broker = await newBroker();
    const A = makeSocket('A');

    broker.acquireMany({uuid: uuidV4(), keys: ['f1', 'f2', 'f3'], ttl: 60_000, wait: false}, A as any);
    const reply = A.sent.find(m => m.type === 'acquire-many');
    assert.ok(reply && reply.acquired === true, 'nw4: free composite no-wait should succeed');
    assert.ok(reply.fencingTokens?.f1 && reply.fencingTokens?.f2 && reply.fencingTokens?.f3,
        'nw4: missing fencing tokens on no-wait grant');
    ok('composite no-wait grabs all keys atomically when uncontended');
}

(async () => {
    try {
        console.log('acquire-many wait/no-wait flag suite');
        await nw1_single_key_no_wait_does_not_enqueue();
        await nw2_composite_no_wait_fails_fast_and_rolls_back();
        await nw3_wait_true_still_queues_and_grants();
        await nw4_composite_no_wait_succeeds_when_free();
        console.log('\n\u2705 all wait/no-wait flag scenarios passed');
        clearTimeout(watchdog);
        process.exit(0);
    } catch (err: any) {
        console.error('\n\u274c FAIL:', err && err.stack || err);
        process.exit(1);
    }
})();
