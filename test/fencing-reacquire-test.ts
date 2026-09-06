'use strict';

/**
 * Fencing-token semantics for Broker1: monotonicity across re-acquire
 * (single-key and multi-key `acquire-many`) and the "never resets while the
 * key lives" guarantee, plus per-key counter independence.
 *
 * Mirrors the Rust broker's `tests/fencing_extra.rs` so both implementations
 * are held to the same fencing contract.
 *
 *   1. composite re-acquire — re-acquiring the same key set (and an
 *      overlapping set) yields strictly greater per-key tokens.
 *   2. single-key monotonicity — 50 acquire/release cycles on one key climb
 *      strictly; a second key keeps an independent (also monotonic) counter.
 */

import * as assert from 'assert';
import {Broker1, setLogLevel} from '../dist/main';
import {v4 as uuidV4} from 'uuid';

setLogLevel('error');

function ok(msg: string) {
    console.log('  \u2713', msg);
}

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: fencing-reacquire-test took too long');
    process.exit(1);
}, 15_000);
watchdog.unref();

interface FakeSocket {
    label: string;
    writable: boolean;
    sent: any[];
    cursor: number;
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
        cursor: 0,
        write(chunk: any): boolean {
            try {
                const lines = chunk.toString().trim().split('\n').filter(Boolean);
                for (const line of lines) sent.push(JSON.parse(line));
            } catch { /* best-effort */ }
            return true;
        },
        end() { /* noop */ },
        destroy() { /* noop */ },
        on() { /* noop */ },
    };
}

function newFrames(ws: FakeSocket): any[] {
    const f = ws.sent.slice(ws.cursor);
    ws.cursor = ws.sent.length;
    return f;
}

async function newBroker(): Promise<Broker1> {
    const broker = new Broker1({port: 0, host: '127.0.0.1', noListen: true} as any);
    (broker as any).emitter.on('warning', () => { /* swallow */ });
    await broker.ensure();
    return broker;
}

async function compositeReacquireTokensStrictlyIncrease() {
    console.log('[1] composite re-acquire yields strictly greater per-key fencing tokens');
    const broker = await newBroker();
    const A = makeSocket('A');
    const abc = ['fe-a', 'fe-b', 'fe-c'];

    broker.acquireMany({uuid: uuidV4(), keys: abc, ttl: 120_000, wait: false} as any, A as any);
    const g1 = newFrames(A).find(m => m.type === 'acquire-many' && m.acquired);
    assert.ok(g1, '1: first composite did not grant');
    const t1 = g1.fencingTokens;
    assert.strictEqual(Object.keys(t1).length, 3, '1: a token per key expected');
    broker.releaseMany({uuid: uuidV4(), lockUuid: g1.lockUuid} as any, A as any);
    newFrames(A);

    broker.acquireMany({uuid: uuidV4(), keys: abc, ttl: 120_000, wait: false} as any, A as any);
    const g2 = newFrames(A).find(m => m.type === 'acquire-many' && m.acquired);
    assert.ok(g2, '1: re-acquire did not grant');
    const t2 = g2.fencingTokens;
    for (const k of abc) {
        assert.ok(t2[k] > t1[k], `1: re-acquire of ${k} must increase: ${t2[k]} !> ${t1[k]}`);
    }
    broker.releaseMany({uuid: uuidV4(), lockUuid: g2.lockUuid} as any, A as any);
    newFrames(A);

    const bcd = ['fe-b', 'fe-c', 'fe-d'];
    broker.acquireMany({uuid: uuidV4(), keys: bcd, ttl: 120_000, wait: false} as any, A as any);
    const g3 = newFrames(A).find(m => m.type === 'acquire-many' && m.acquired);
    assert.ok(g3, '1: overlapping composite did not grant');
    const t3 = g3.fencingTokens;
    assert.ok(t3['fe-b'] > t2['fe-b'], '1: overlap key b must keep increasing');
    assert.ok(t3['fe-c'] > t2['fe-c'], '1: overlap key c must keep increasing');
    assert.ok(t3['fe-d'] >= 1, '1: fresh key d must have a positive token');
    ok('composite re-acquire (same + overlapping sets) keeps per-key tokens strictly increasing');
}

async function singleKeyFencingMonotonicAndIndependent() {
    console.log('[2] single-key fencing never resets across cycles; per-key counters independent');
    const broker = await newBroker();
    const A = makeSocket('A');

    let lastX = 0, firstX = 0;
    for (let i = 0; i < 50; i++) {
        const uuid = uuidV4();
        broker.lock({uuid, key: 'fe-x', ttl: 120_000, wait: false} as any, A as any);
        const g = newFrames(A).find(m => m.type === 'lock' && m.acquired);
        assert.ok(g, `2: fe-x cycle ${i} did not grant`);
        assert.ok(g.fencingToken > lastX, `2: fe-x must strictly increase at cycle ${i}: ${g.fencingToken} !> ${lastX}`);
        if (i === 0) firstX = g.fencingToken;
        lastX = g.fencingToken;
        broker.unlock({uuid: uuidV4(), key: 'fe-x', _uuid: uuid} as any, A as any);
        newFrames(A);
    }

    let lastY = 0, firstY = 0;
    for (let i = 0; i < 5; i++) {
        const uuid = uuidV4();
        broker.lock({uuid, key: 'fe-y', ttl: 120_000, wait: false} as any, A as any);
        const g = newFrames(A).find(m => m.type === 'lock' && m.acquired);
        assert.ok(g, `2: fe-y cycle ${i} did not grant`);
        assert.ok(g.fencingToken > lastY, `2: fe-y must strictly increase at cycle ${i}: ${g.fencingToken} !> ${lastY}`);
        if (i === 0) firstY = g.fencingToken;
        lastY = g.fencingToken;
        broker.unlock({uuid: uuidV4(), key: 'fe-y', _uuid: uuid} as any, A as any);
        newFrames(A);
    }

    assert.ok(lastX - firstX >= 49, `2: fe-x should advance once per cycle (span=${lastX - firstX})`);
    assert.ok(lastY - firstY >= 4, `2: fe-y should advance once per cycle (span=${lastY - firstY})`);
    assert.ok((lastX - firstX) > (lastY - firstY), '2: per-key counters must be independent');
    ok('single-key fencing is strictly monotonic across 50 cycles; counters are per-key independent');
}

(async () => {
    try {
        console.log('fencing re-acquire + monotonicity suite (Broker1)');
        await compositeReacquireTokensStrictlyIncrease();
        await singleKeyFencingMonotonicAndIndependent();
        console.log('\n\u2705 all fencing re-acquire scenarios passed');
        clearTimeout(watchdog);
        process.exit(0);
    } catch (err: any) {
        console.error('\n\u274c FAIL:', (err && err.stack) || err);
        process.exit(1);
    }
})();
