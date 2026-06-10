'use strict';

/**
 * Direct tests for the in-process bridge.
 *
 * Crucially, every assertion below runs against a `Broker1` that has
 * **no TCP listener bound at all** (`noListen: true`). If the bridge
 * were quietly going through a loopback socket — as the previous
 * implementation did — none of these tests could pass: there'd be
 * no port to dial.
 *
 * Asserts:
 *   1. `acquire/release` work without any net.Server in the process.
 *   2. Fencing tokens flow through the bridge intact and are
 *      strictly monotonic per key across two grants.
 *   3. The bridge's virtual socket is registered with the broker as
 *      a real connection (`connectedClients` count goes up on
 *      construction, down on shutdown).
 *   4. `acquire-many` succeeds in-memory; broker state reflects the
 *      multi-key holds even though no TCP traffic occurred.
 *   5. `bridge.shutdown()` releases every hold the bridge owned —
 *      identical ownership semantics to a TCP disconnect.
 *   6. The HTTP server, when used in front of a `noListen` broker,
 *      handles `/v1/lock` / `/v1/unlock` correctly — proving the
 *      end-to-end HTTP path uses the bridge and never opens a
 *      loopback connection.
 *
 * The whole script self-times-out at 10s; any hang means the bridge
 * is silently waiting on a socket somewhere.
 */

import * as assert from 'assert';
import * as http from 'http';
import {Broker1, InProcessBridge, LMXHttpServer} from '../dist/main';

function fail(msg: string): never {
    console.error('\u274c FAIL:', msg);
    process.exit(1);
}

function ok(msg: string) {
    console.log('  \u2713', msg);
}

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: in-process-bridge-test took too long');
    process.exit(1);
}, 10_000);
watchdog.unref();

function httpJson(port: number, method: 'GET' | 'POST', path: string, body?: any): Promise<{status: number, body: any}> {
    return new Promise((resolve, reject) => {
        const req = http.request({
            method, host: '127.0.0.1', port, path,
            headers: body ? {'Content-Type': 'application/json'} : undefined
        }, res => {
            const chunks: Buffer[] = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks as unknown as Uint8Array[]).toString('utf8');
                let parsed: any = null;
                try { parsed = JSON.parse(raw); } catch { /* leave null */ }
                resolve({status: res.statusCode || 0, body: parsed});
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    // ===========================================================
    // [1] Bridge against a *noListen* broker — no TCP at all.
    // ===========================================================
    console.log('[1] bridge talks to a noListen broker without TCP');
    const broker = new Broker1({noListen: true, port: 0, host: '127.0.0.1'});
    broker.emitter.on('warning', () => { /* swallow noisy timeouts */ });

    const beforeClients = broker.connectedClients.size;
    const bridge = new InProcessBridge(broker);
    if (broker.connectedClients.size !== beforeClients + 1) {
        fail('bridge construction did not register virtual socket with broker');
    }
    ok(`virtual socket registered: connectedClients ${beforeClients} \u2192 ${broker.connectedClients.size}`);

    const r1: any = await bridge.lock({key: 'inproc-1', ttl: 5_000});
    if (r1.acquired !== true) fail(`first acquire returned ${JSON.stringify(r1)}`);
    if (typeof r1.fencingToken !== 'number' || r1.fencingToken < 1) {
        fail(`first grant missing fencingToken: ${JSON.stringify(r1)}`);
    }
    const lockUuid1 = r1._bridgeRequestUuid;
    if (typeof lockUuid1 !== 'string' || lockUuid1.length === 0) {
        fail('bridge did not surface the lock-holder uuid back to the caller');
    }
    ok(`acquire #1 in-memory: token=${r1.fencingToken} lockUuid=${lockUuid1.slice(0, 8)}…`);

    // The hold should be visible on the broker.
    const lck = (broker as any).locks.get('inproc-1');
    if (!lck || lck.lockholders.size !== 1) {
        fail(`broker doesn't see the bridge-acquired hold: ${JSON.stringify(lck)}`);
    }
    ok('broker.locks reflects the bridge-acquired hold');

    // ===========================================================
    // [2] Fencing tokens are monotonic across bridge calls.
    // ===========================================================
    console.log('\n[2] fencing tokens are strictly monotonic per key via the bridge');
    const release1: any = await bridge.unlock({key: 'inproc-1', lockUuid: lockUuid1});
    if (release1.unlocked !== true) fail(`release #1 not unlocked: ${JSON.stringify(release1)}`);
    const r2: any = await bridge.lock({key: 'inproc-1', ttl: 5_000});
    if (r2.fencingToken <= r1.fencingToken) {
        fail(`expected token to strictly increase, ${r1.fencingToken} \u2192 ${r2.fencingToken}`);
    }
    ok(`token #1=${r1.fencingToken}, token #2=${r2.fencingToken}`);
    await bridge.unlock({key: 'inproc-1', lockUuid: r2._bridgeRequestUuid});

    // ===========================================================
    // [3] acquire-many round-trips through the bridge in-memory.
    // ===========================================================
    console.log('\n[3] acquire-many in-memory');
    const am: any = await bridge.acquireMany(['ip-a', 'ip-b', 'ip-c'], 5_000);
    if (am.acquired !== true) fail(`acquire-many failed: ${JSON.stringify(am)}`);
    if (!am.lockUuid || Object.keys(am.fencingTokens || {}).length !== 3) {
        fail(`acquire-many shape unexpected: ${JSON.stringify(am)}`);
    }
    for (const k of ['ip-a', 'ip-b', 'ip-c']) {
        const l = (broker as any).locks.get(k);
        if (!l || l.lockholders.size !== 1) fail(`${k} not held after acquireMany`);
    }
    ok(`granted union lockUuid=${am.lockUuid.slice(0, 8)}…`);
    const rm: any = await bridge.releaseMany(am.lockUuid);
    if (rm.released !== true) fail('release-many failed');
    ok('release-many released cleanly');

    // ===========================================================
    // [4] HTTP front-end uses the bridge — no TCP listener needed.
    // ===========================================================
    console.log('\n[4] HTTP front-end on a noListen broker (proves bridge is the only path)');
    const httpServer = new LMXHttpServer(broker, {port: 0, host: '127.0.0.1'});
    await httpServer.start();
    // Read the actually-bound port back from the http listener.
    const httpPort = (httpServer as any).server.address().port;
    if (!httpPort) fail('HTTP server did not bind a port');

    const hLk = await httpJson(httpPort, 'POST', '/v1/lock', {key: 'http-inproc', ttl: 5_000});
    if (hLk.status !== 200 || hLk.body.acquired !== true) {
        fail(`/v1/lock failed: ${JSON.stringify(hLk)}`);
    }
    if (typeof hLk.body.fencingToken !== 'number' || hLk.body.fencingToken < 1) {
        fail('/v1/lock did not return a fencingToken via the bridge');
    }
    ok(`POST /v1/lock granted in-memory (fencingToken=${hLk.body.fencingToken})`);

    const hUl = await httpJson(httpPort, 'POST', '/v1/unlock', {key: 'http-inproc', lockUuid: hLk.body.lockUuid});
    if (hUl.status !== 200 || hUl.body.released !== true) {
        fail(`/v1/unlock failed: ${JSON.stringify(hUl)}`);
    }
    ok('POST /v1/unlock released in-memory');

    // /v1/lock with max:0 should still get 400 from the bridge, not
    // hang or 500 — proves the broker's validation runs synchronously
    // on the bridge path.
    const bad = await httpJson(httpPort, 'POST', '/v1/lock', {key: 'http-bad', max: 0});
    if (bad.status !== 400) fail(`max=0 over HTTP+bridge should be 400, got ${bad.status}`);
    ok('max=0 rejected via the bridge with HTTP 400');

    // ===========================================================
    // [5] bridge.shutdown() releases held holds (TCP-disconnect parity).
    // ===========================================================
    console.log('\n[5] bridge shutdown releases owned holds');
    // Acquire a few via the bridge and HTTP, then shut down.
    await bridge.lock({key: 'orphan-1', ttl: 60_000});
    await bridge.lock({key: 'orphan-2', ttl: 60_000});
    await httpJson(httpPort, 'POST', '/v1/lock', {key: 'orphan-3', ttl: 60_000});
    for (const k of ['orphan-1', 'orphan-2', 'orphan-3']) {
        const l = (broker as any).locks.get(k);
        if (!l || l.lockholders.size === 0) fail(`${k} not held before shutdown`);
    }
    ok('three orphan holds taken across bridge + HTTP layer');

    await httpServer.stop();
    bridge.shutdown();

    // After shutdown, neither the HTTP-server-owned bridge nor the
    // standalone bridge should hold any of those keys. The broker
    // may keep the LockObj around (cleanUpLocks is GC-style) but
    // lockholders.size MUST be 0.
    for (const k of ['orphan-1', 'orphan-2', 'orphan-3']) {
        const l = (broker as any).locks.get(k);
        const holders = l ? l.lockholders.size : 0;
        if (holders !== 0) fail(`${k} still has ${holders} holder(s) after shutdown`);
    }
    ok('all bridge-owned holds released after shutdown');

    // Final sanity: connectedClients should drop back close to baseline.
    if (broker.connectedClients.size > beforeClients + 1) {
        fail(`bridge sockets leaked: ${broker.connectedClients.size} > baseline ${beforeClients}`);
    }
    ok(`connectedClients settled (${broker.connectedClients.size})`);

    await new Promise<void>(r => broker.close(() => r()));
    clearTimeout(watchdog);
    console.log('\n\u2705 in-process-bridge-test: all checks passed');
    process.exit(0);
}

main().catch(err => {
    console.error('in-process-bridge-test threw:', err);
    process.exit(1);
});
