'use strict';

/**
 * Stress / fuzz coverage for fencing tokens and multi-key (`acquire-many`)
 * composites against the canonical advanced broker (`Broker1`), driven
 * in-process (no TCP) so every request resolves synchronously and the fuzz is
 * fully deterministic per seed.
 *
 * Three suites:
 *
 *   A. NO-WAIT MODEL FUZZ — thousands of randomized single + composite
 *      `wait:false` ops against a shadow model. After every op we assert:
 *        * acquired == (model says all requested keys free)   [try-lock truth]
 *        * per-key fencing token strictly increases            [fencing]
 *        * a composite grant carries a token for EVERY key     [atomicity]
 *        * a free key is never held by >1 lock                 [mutual excl.]
 *        * a failed composite leaves no free member half-locked [rollback]
 *
 *   B. WAIT LIVENESS FUZZ — randomized blocking (`wait:true`) single +
 *      composite ops, then a DRAIN-TO-EMPTY check: release every full holder
 *      (cascading the grants that unblocks); if the broker is live, every
 *      queued waiter must end up granted. A waiter still queued once all keys
 *      are free is a livelock / missed-wakeup. (This is the TS analogue of the
 *      Rust composite-liveness regression.)
 *
 *   C. WAIT FIFO FENCING — N waiters queue on one key; releasing in a cascade
 *      must grant them FIFO with strictly increasing fencing tokens.
 *
 * Each op pokes the broker directly and inspects emitted frames + internal
 * lock state.
 */

import * as assert from 'assert';
import {Broker1, setLogLevel} from '../dist/main';
import {v4 as uuidV4} from 'uuid';

// This fuzz runs tens of thousands of broker calls; the per-routine `info`
// log line would bury the assertions. Quiet it (warnings/errors still print).
setLogLevel('error');

function ok(msg: string) {
    console.log('  \u2713', msg);
}

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: fencing-multikey-stress-test took too long');
    process.exit(1);
}, 45_000);
watchdog.unref();

// -- deterministic RNG (mulberry32) ----------------------------------------
function makeRng(seed: number) {
    let a = seed >>> 0;
    return {
        next(): number {
            a |= 0;
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        },
        below(n: number): number {
            return Math.floor(this.next() * n);
        },
    };
}

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
            } catch {
                /* best-effort capture */
            }
            return true;
        },
        end() { /* noop */ },
        destroy() { /* noop */ },
        on() { /* noop */ },
    };
}

/** Frames appended to this socket since the last drain. */
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

function holdersOf(broker: Broker1, key: string): number {
    const lck = (broker as any).locks.get(key);
    return lck ? lck.lockholders.size : 0;
}

// ===========================================================================
// Suite A — no-wait model fuzz
// ===========================================================================

interface HeldLock {
    kind: 'single' | 'composite';
    keys: string[];
    id: string; // holder uuid (single) or composite lockUuid
}

function noWaitModelFuzz(broker: Broker1, seed: number, ops: number) {
    const nClients = 8;
    const clients = Array.from({length: nClients}, (_, i) => makeSocket(`A${seed}_${i}`));
    const keys = Array.from({length: 6}, (_, i) => `nw${seed}-${i}`);

    const heldByKey = new Map<string, number>(); // key -> client idx
    const held: HeldLock[][] = Array.from({length: nClients}, () => [] as HeldLock[]);
    const lastToken = new Map<string, number>();
    const rng = makeRng(seed * 2654435761);
    let seq = 0;

    const checkToken = (key: string, tok: number) => {
        assert.ok(typeof tok === 'number' && tok >= 1, `seed=${seed}: token for ${key} must be >=1, got ${tok}`);
        const prev = lastToken.get(key) ?? 0;
        assert.ok(tok > prev, `seed=${seed}: fencing token for ${key} not strictly increasing: prev=${prev} new=${tok}`);
        lastToken.set(key, tok);
    };

    for (let i = 0; i < ops; i++) {
        const ci = rng.below(nClients);
        const ws = clients[ci];
        const roll = rng.below(100);

        if (roll < 35) {
            // single-key no-wait
            const key = keys[rng.below(keys.length)];
            seq++;
            const uuid = `s${seq}`;
            broker.lock({uuid, key, ttl: 600_000, wait: false} as any, ws as any);
            const reply = newFrames(ws).find(m => m.type === 'lock');
            assert.ok(reply, `seed=${seed}: no single lock reply`);
            const expectedFree = !heldByKey.has(key);
            assert.strictEqual(reply.acquired, expectedFree,
                `seed=${seed}: single(${key}) acquired=${reply.acquired} but model free=${expectedFree}`);
            if (reply.acquired) {
                checkToken(key, reply.fencingToken);
                heldByKey.set(key, ci);
                held[ci].push({kind: 'single', keys: [key], id: uuid});
            }
        } else if (roll < 70) {
            // composite no-wait (2..=4 distinct keys)
            const want = 2 + rng.below(3);
            const pool = keys.slice();
            const chosen: string[] = [];
            for (let j = 0; j < want && pool.length; j++) {
                chosen.push(pool.splice(rng.below(pool.length), 1)[0]);
            }
            chosen.sort();
            seq++;
            const uuid = `c${seq}`;
            broker.acquireMany({uuid, keys: chosen, ttl: 600_000, wait: false} as any, ws as any);
            const reply = newFrames(ws).find(m => m.type === 'acquire-many');
            assert.ok(reply, `seed=${seed}: no acquire-many reply`);
            const expectedFree = chosen.every(k => !heldByKey.has(k));
            assert.strictEqual(reply.acquired, expectedFree,
                `seed=${seed}: composite(${chosen}) acquired=${reply.acquired} but model all-free=${expectedFree}`);
            if (reply.acquired) {
                const toks = reply.fencingTokens || {};
                assert.strictEqual(Object.keys(toks).length, chosen.length,
                    `seed=${seed}: composite atomicity: tokens ${JSON.stringify(toks)} != keys ${chosen}`);
                for (const k of chosen) {
                    checkToken(k, toks[k]);
                    heldByKey.set(k, ci);
                }
                held[ci].push({kind: 'composite', keys: chosen, id: reply.lockUuid});
            } else {
                // Rollback invariant: any member the model considers free must
                // not have been left half-locked by the failed attempt.
                for (const k of chosen) {
                    if (!heldByKey.has(k)) {
                        assert.strictEqual(holdersOf(broker, k), 0,
                            `seed=${seed}: failed composite left ${k} half-locked`);
                    }
                }
            }
        } else {
            // release a random held lock
            if (held[ci].length === 0) continue;
            const idx = rng.below(held[ci].length);
            const lock = held[ci].splice(idx, 1)[0];
            seq++;
            if (lock.kind === 'single') {
                broker.unlock({uuid: `u${seq}`, key: lock.keys[0], _uuid: lock.id} as any, ws as any);
            } else {
                broker.releaseMany({uuid: `u${seq}`, lockUuid: lock.id} as any, ws as any);
            }
            newFrames(ws);
            for (const k of lock.keys) heldByKey.delete(k);
        }
    }

    // Teardown: release everything, then prove every key is individually free.
    for (let ci = 0; ci < nClients; ci++) {
        for (const lock of held[ci]) {
            seq++;
            if (lock.kind === 'single') {
                broker.unlock({uuid: `tu${seq}`, key: lock.keys[0], _uuid: lock.id} as any, clients[ci] as any);
            } else {
                broker.releaseMany({uuid: `tu${seq}`, lockUuid: lock.id} as any, clients[ci] as any);
            }
        }
        held[ci].length = 0;
    }
    for (const k of keys) {
        assert.strictEqual(holdersOf(broker, k), 0, `seed=${seed}: key ${k} still held after teardown`);
    }
}

// ===========================================================================
// Suite B — wait liveness fuzz (drain-to-empty)
// ===========================================================================

type Agent =
    | {state: 'idle'}
    | {state: 'waiting'; reqUuid: string; keys: string[]; kind: 'single' | 'composite'}
    | {state: 'holding'; reqUuid: string; id: string; keys: string[]; kind: 'single' | 'composite'};

/** Scan every client's new frames and promote a waiting agent whose terminal
 *  grant (acquired:true) has arrived. Returns nothing; mutates `agents`. */
function promoteGrants(clients: FakeSocket[], agents: Agent[]) {
    for (let i = 0; i < clients.length; i++) {
        const frames = newFrames(clients[i]);
        const a = agents[i];
        if (a.state !== 'waiting') continue;
        for (const m of frames) {
            if (m.acquired === true && m.uuid === a.reqUuid &&
                (m.type === 'lock' || m.type === 'acquire-many')) {
                const id = a.kind === 'single' ? a.reqUuid : m.lockUuid;
                agents[i] = {state: 'holding', reqUuid: a.reqUuid, id, keys: a.keys, kind: a.kind};
                break;
            }
        }
    }
}

function releaseAgent(broker: Broker1, clients: FakeSocket[], agents: Agent[], i: number) {
    const a = agents[i];
    if (a.state !== 'holding') return;
    if (a.kind === 'single') {
        broker.unlock({uuid: uuidV4(), key: a.keys[0], _uuid: a.id} as any, clients[i] as any);
    } else {
        broker.releaseMany({uuid: uuidV4(), lockUuid: a.id} as any, clients[i] as any);
    }
    agents[i] = {state: 'idle'};
    promoteGrants(clients, agents);
}

function waitLivenessFuzz(broker: Broker1, seed: number, rounds: number, opsPerRound: number) {
    const nAgents = 8;
    const clients = Array.from({length: nAgents}, (_, i) => makeSocket(`L${seed}_${i}`));
    const keys = Array.from({length: 4}, (_, i) => `lw${seed}-${i}`);
    const agents: Agent[] = Array.from({length: nAgents}, () => ({state: 'idle'}) as Agent);
    const rng = makeRng((seed + 1) * 40503);
    let seq = 0;

    for (let round = 0; round < rounds; round++) {
        for (let op = 0; op < opsPerRound; op++) {
            const i = rng.below(nAgents);
            const a = agents[i];
            if (a.state === 'idle') {
                seq++;
                const uuid = `w${seq}`;
                if (rng.below(100) < 50) {
                    const key = keys[rng.below(keys.length)];
                    broker.lock({uuid, key, ttl: 600_000, wait: true} as any, clients[i] as any);
                    const reply = newFrames(clients[i]).find(m => m.type === 'lock');
                    if (reply && reply.acquired) {
                        agents[i] = {state: 'holding', reqUuid: uuid, id: uuid, keys: [key], kind: 'single'};
                    } else {
                        agents[i] = {state: 'waiting', reqUuid: uuid, keys: [key], kind: 'single'};
                    }
                } else {
                    const want = 2 + rng.below(2);
                    const pool = keys.slice();
                    const chosen: string[] = [];
                    for (let j = 0; j < want && pool.length; j++) {
                        chosen.push(pool.splice(rng.below(pool.length), 1)[0]);
                    }
                    chosen.sort();
                    broker.acquireMany({uuid, keys: chosen, ttl: 600_000, wait: true} as any, clients[i] as any);
                    const reply = newFrames(clients[i]).find(m => m.type === 'acquire-many');
                    if (reply && reply.acquired) {
                        agents[i] = {state: 'holding', reqUuid: uuid, id: reply.lockUuid, keys: chosen, kind: 'composite'};
                    } else {
                        agents[i] = {state: 'waiting', reqUuid: uuid, keys: chosen, kind: 'composite'};
                    }
                }
            } else if (a.state === 'holding') {
                releaseAgent(broker, clients, agents, i);
            }
            // waiting agents can't act
        }

        // DRAIN-TO-EMPTY: release every full holder, cascading.
        let guard = 0;
        while (true) {
            if (++guard > 100_000) throw new Error(`seed=${seed} round=${round}: drain runaway`);
            const idx = agents.findIndex(a => a.state === 'holding');
            if (idx < 0) break;
            releaseAgent(broker, clients, agents, idx);
        }

        const stuck = agents
            .map((a, i) => ({a, i}))
            .filter(({a}) => a.state === 'waiting')
            .map(({a, i}) => ({i, keys: (a as any).keys}));
        if (stuck.length > 0) {
            console.error(`seed=${seed} round=${round}: stuck waiters`, JSON.stringify(stuck));
            for (const k of keys) {
                console.error(`  key=${k} holders=${holdersOf(broker, k)} queue=${((broker as any).locks.get(k)?.notify.length) ?? 0}`);
            }
        }
        assert.strictEqual(stuck.length, 0,
            `seed=${seed} round=${round}: LIVENESS BUG — waiters still queued after all keys freed: ${JSON.stringify(stuck)}`);

        for (const k of keys) {
            assert.strictEqual(holdersOf(broker, k), 0, `seed=${seed} round=${round}: ${k} held after drain`);
        }
    }
}

// ===========================================================================
// Suite C — wait FIFO fencing monotonicity (single key)
// ===========================================================================

function waitFifoFencing(broker: Broker1) {
    const key = 'fifo-fence';
    const clients = Array.from({length: 4}, (_, i) => makeSocket(`F${i}`));
    let last = 0;

    broker.lock({uuid: 'f0', key, ttl: 600_000, wait: true} as any, clients[0] as any);
    let grant = newFrames(clients[0]).find(m => m.type === 'lock' && m.acquired);
    assert.ok(grant, 'f0 did not acquire');
    assert.ok(grant.fencingToken > last, 'first token must be positive');
    last = grant.fencingToken;
    let holderUuid = 'f0';

    for (let i = 1; i < 4; i++) {
        broker.lock({uuid: `f${i}`, key, ttl: 600_000, wait: true} as any, clients[i] as any);
        const q = newFrames(clients[i]).find(m => m.type === 'lock');
        assert.ok(q && q.acquired === false, `f${i} should be queued`);
    }

    for (let i = 1; i < 4; i++) {
        broker.unlock({uuid: `r${i}`, key, _uuid: holderUuid} as any, clients[i - 1] as any);
        const g = newFrames(clients[i]).find(m => m.type === 'lock' && m.acquired);
        assert.ok(g, `f${i} did not get a grant after release`);
        assert.ok(g.fencingToken > last,
            `fencing token must strictly increase through wait queue: prev=${last} new=${g.fencingToken}`);
        last = g.fencingToken;
        holderUuid = `f${i}`;
    }
}

// ===========================================================================

(async () => {
    try {
        console.log('fencing + multi-key stress/fuzz suite (Broker1)');

        console.log('[A] no-wait model fuzz (fencing monotonic + composite atomicity + mutual exclusion)');
        {
            const seeds = [1, 2, 3, 7, 42, 1337, 99991, 2718281, 524287, 31415926];
            for (const seed of seeds) {
                const broker = await newBroker();
                noWaitModelFuzz(broker, seed, 5000);
            }
            ok(`no-wait model fuzz: invariants held across ${seeds.length} seeds x 5000 ops`);
        }

        console.log('[B] wait liveness fuzz (drain-to-empty; probes composite livelock / missed-wakeup)');
        {
            const seeds = [1, 5, 11, 23, 42, 101, 1009, 31337, 60013, 99173];
            for (const seed of seeds) {
                const broker = await newBroker();
                waitLivenessFuzz(broker, seed, 80, 24);
            }
            ok(`wait liveness fuzz: every contended composite eventually drained, ${seeds.length} seeds x 80 rounds`);
        }

        console.log('[C] wait FIFO fencing monotonicity (single key)');
        {
            const broker = await newBroker();
            waitFifoFencing(broker);
        }
        ok('wait queue grants are FIFO with strictly increasing fencing tokens');

        console.log('\n\u2705 all fencing/multi-key stress scenarios passed');
        clearTimeout(watchdog);
        process.exit(0);
    } catch (err: any) {
        console.error('\n\u274c FAIL:', (err && err.stack) || err);
        process.exit(1);
    }
})();
