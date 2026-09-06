'use strict';

/**
 * End-to-end test for the broker improvements added in
 * `feat/sweeper-fencing-acquire-many-http`:
 *
 *   1. Single broker-wide TTL sweeper (replaces per-holder setTimeout).
 *   2. Broker-side `max <= 0` rejection.
 *   3. Per-key monotonic fencing tokens on every grant.
 *   4. `acquire-many` / `release-many` (union semantics, sorted lock order).
 *   5. HTTP server on a separate port + status page + Prometheus metrics.
 *
 * Runs against a single Broker1 instance (TCP + HTTP) and exits with
 * the standard 0/1 convention used by `scripts/run-tests.js`.
 */

import * as assert from 'assert';
import * as net from 'net';
import * as http from 'http';
import * as UUID from 'uuid';
import {Broker1, Client, LMXHttpServer} from '../dist/main';
import {createParser} from '../dist/json-parser';

const PORT = 8000 + Math.floor(Math.random() * 800);
const HTTP_PORT = PORT + 1000;

function fail(msg: string): never {
    console.error('❌ FAIL:', msg);
    process.exit(1);
}

function ok(msg: string) {
    console.log('  ✓', msg);
}

function rawRequest(payload: any): Promise<any[]> {
    // Issue a single TCP request without going through the JS Client.
    // Lets us inspect the raw broker reply (incl. fencingToken,
    // contendedKey, etc.) and assert exact wire-shape behaviour.
    return new Promise((resolve, reject) => {
        const sock = net.connect(PORT, '127.0.0.1');
        const replies: any[] = [];
        const t = setTimeout(() => {
            sock.destroy();
            reject(new Error('rawRequest timed out'));
        }, 5_000);
        sock.once('connect', () => {
            sock.write(JSON.stringify({type: 'version', value: '0.2.25'}) + '\n');
            sock.write(JSON.stringify(payload) + '\n');
        });
        sock.pipe(createParser())
            .on('data', (msg: any) => {
                replies.push(msg);
                // Heuristic: stop after the first non-handshake reply.
                if (msg && msg.type !== 'version-mismatch') {
                    clearTimeout(t);
                    sock.end();
                    sock.destroy();
                    resolve(replies);
                }
            })
            .on('error', err => { clearTimeout(t); reject(err); });
        sock.on('error', err => { clearTimeout(t); reject(err); });
    });
}

function httpJson(method: 'GET' | 'POST', path: string, body?: any): Promise<{status: number, body: any, raw: string}> {
    return new Promise((resolve, reject) => {
        const req = http.request({
            method, host: '127.0.0.1', port: HTTP_PORT, path,
            headers: body ? {'Content-Type': 'application/json'} : undefined
        }, res => {
            const chunks: Buffer[] = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks as unknown as Uint8Array[]).toString('utf8');
                let parsed: any = null;
                try { parsed = JSON.parse(raw); } catch (_) { /* leave null */ }
                resolve({status: res.statusCode || 0, body: parsed, raw});
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    const broker = new Broker1({port: PORT, host: '127.0.0.1'});
    broker.emitter.on('warning', () => { /* swallow noisy timeouts */ });
    await broker.ensure();

    const httpServer = new LMXHttpServer(broker, {port: HTTP_PORT, host: '127.0.0.1'});
    await httpServer.start();

    console.log(`broker on ${PORT}, http on ${HTTP_PORT}`);

    // ---------------------------------------------------------------
    // 1. Fencing tokens are present and strictly monotonic per key.
    //    The broker seeds the per-key counter from `Date.now()` on
    //    LockObj creation, so tokens look like 1.7e12 today, not 1.
    // ---------------------------------------------------------------
    console.log('\n[1] fencing tokens are monotonic per key');
    {
        const c = new Client({port: PORT});
        await c.connect();
        const a: any = await c.acquire('fkey');
        if (typeof a.fencingToken !== 'number' || a.fencingToken < 1) {
            fail(`expected fencingToken >= 1 on first grant, got ${a.fencingToken}`);
        }
        // Wall-clock seeded means the token should be in the
        // ballpark of "now" for a freshly-created LockObj. Allow a
        // generous fudge factor so this test isn't sensitive to GC
        // pauses or weird CI clocks.
        const now = Date.now();
        if (a.fencingToken < now - 60_000 || a.fencingToken > now + 60_000) {
            fail(`expected fencingToken close to wall-clock now=${now}, got ${a.fencingToken}`);
        }
        const firstToken = a.fencingToken;
        await c.release('fkey', a.id);
        const b: any = await c.acquire('fkey');
        if (b.fencingToken <= firstToken) {
            fail(`expected token to strictly increase, ${firstToken} -> ${b.fencingToken}`);
        }
        await c.release('fkey', b.id);
        c.close();
        ok(`fencingToken[1] = ${firstToken}, fencingToken[2] = ${b.fencingToken}, delta = ${b.fencingToken - firstToken}`);
    }

    // ---------------------------------------------------------------
    // 2. `max <= 0` is rejected up-front; broker emits an error reply
    //    and never mutates any LockObj state.
    // ---------------------------------------------------------------
    console.log('\n[2] max=0 / max=-1 rejected with explicit error');
    {
        const replies = await rawRequest({
            type: 'lock', uuid: UUID.v4(), key: 'maxzero', max: 0, ttl: 5000
        });
        const last = replies[replies.length - 1];
        if (last.acquired !== false) fail('max=0 should not be granted');
        if (!last.error) fail('max=0 should produce an error message');
        if (broker['locks'].has('maxzero')) {
            fail('max=0 leaked a LockObj into the broker state');
        }
        ok(`max=0 rejected: "${last.error}"`);

        const replies2 = await rawRequest({
            type: 'lock', uuid: UUID.v4(), key: 'maxneg', max: -3, ttl: 5000
        });
        const last2 = replies2[replies2.length - 1];
        if (last2.acquired !== false || !last2.error) {
            fail('max=-3 should produce an error reply');
        }
        ok(`max=-3 rejected: "${last2.error}"`);
    }

    // ---------------------------------------------------------------
    // 3. acquire-many holds N keys atomically and returns one
    //    fencing token per key.
    // ---------------------------------------------------------------
    console.log('\n[3] acquire-many / release-many round-trip');
    {
        const replies = await rawRequest({
            type: 'acquire-many', uuid: UUID.v4(), keys: ['m-a', 'm-b', 'm-c'], ttl: 5000
        });
        const r = replies[replies.length - 1];
        if (r.type !== 'acquire-many' || r.acquired !== true) {
            fail(`expected acquire-many granted, got ${JSON.stringify(r)}`);
        }
        if (!r.lockUuid || typeof r.lockUuid !== 'string') {
            fail('acquire-many should return a lockUuid');
        }
        if (!r.fencingTokens || Object.keys(r.fencingTokens).length !== 3) {
            fail('acquire-many should return one fencingToken per key');
        }
        ok(`granted lockUuid=${r.lockUuid.slice(0, 8)}… for keys=[${r.keys.join(', ')}]`);

        // Release.
        const rr = await rawRequest({type: 'release-many', uuid: UUID.v4(), lockUuid: r.lockUuid});
        const last = rr[rr.length - 1];
        if (last.type !== 'release-many' || last.released !== true) {
            fail(`expected release-many succeeded, got ${JSON.stringify(last)}`);
        }
        ok(`released ${last.keys.length} key(s)`);
    }

    // ---------------------------------------------------------------
    // 4. acquire-many returns `contendedKey` when one of the keys is
    //    held; nothing else is granted (all-or-nothing union).
    // ---------------------------------------------------------------
    console.log('\n[4] acquire-many returns contendedKey on any-key conflict');
    {
        const c = new Client({port: PORT});
        await c.connect();
        const held: any = await c.acquire('held-key');
        const replies = await rawRequest({
            type: 'acquire-many', uuid: UUID.v4(), keys: ['fresh-1', 'held-key', 'fresh-2'], ttl: 5000
        });
        const r = replies[replies.length - 1];
        if (r.acquired !== false) {
            fail('expected union grant to fail when one key is held');
        }
        if (r.contendedKey !== 'held-key') {
            fail(`expected contendedKey='held-key', got ${r.contendedKey}`);
        }
        // Verify rollback: fresh-1 / fresh-2 should not have any
        // holders left over.
        for (const k of ['fresh-1', 'fresh-2']) {
            const lck = broker['locks'].get(k);
            if (lck && lck.lockholders.size > 0) {
                fail(`rollback failed: ${k} still has ${lck.lockholders.size} holders`);
            }
        }
        await c.release('held-key', held.id);
        c.close();
        ok('contended union request rolled back cleanly');
    }

    // ---------------------------------------------------------------
    // 5. HTTP /healthz, /metrics, /v1/stats, /, /v1/lock + /v1/unlock.
    // ---------------------------------------------------------------
    console.log('\n[5] HTTP front-end');
    {
        const h = await httpJson('GET', '/healthz');
        if (h.status !== 200 || h.body?.ok !== true) {
            fail(`/healthz unexpected: ${JSON.stringify(h)}`);
        }
        ok('/healthz -> 200 ok=true');

        const m = await httpJson('GET', '/metrics');
        if (m.status !== 200) fail('/metrics did not return 200');
        if (!m.raw.includes('lmx_keys')) fail('/metrics missing lmx_keys');
        if (!m.raw.includes('lmx_pending_deadlines')) fail('/metrics missing lmx_pending_deadlines');
        if (!m.raw.includes('lmx_ttl_evictions_total')) fail('/metrics missing lmx_ttl_evictions_total');
        ok('/metrics emits Prometheus exposition with the new counters');

        const s = await httpJson('GET', '/v1/stats');
        if (s.status !== 200 || typeof s.body?.totalLocks !== 'number') {
            fail('/v1/stats did not return a stats snapshot');
        }
        ok(`/v1/stats -> totalLocks=${s.body.totalLocks}, pendingDeadlines=${s.body.pendingDeadlines}`);

        const root = await httpJson('GET', '/');
        if (root.status !== 200 || !root.raw.startsWith('<!doctype html>')) {
            fail('/ did not return HTML status page');
        }
        ok('/ served HTML status page');
    }

    {
        const lk = await httpJson('POST', '/v1/lock', {key: 'http-key', ttl: 5000});
        if (lk.status !== 200 || !lk.body?.acquired) {
            fail(`POST /v1/lock failed: ${JSON.stringify(lk)}`);
        }
        if (typeof lk.body.fencingToken !== 'number') {
            fail('POST /v1/lock did not return a fencingToken');
        }
        ok(`POST /v1/lock granted with fencingToken=${lk.body.fencingToken}`);

        const ul = await httpJson('POST', '/v1/unlock', {key: 'http-key', lockUuid: lk.body.lockUuid});
        if (ul.status !== 200 || ul.body?.released !== true) {
            fail(`POST /v1/unlock failed: ${JSON.stringify(ul)}`);
        }
        ok('POST /v1/unlock released cleanly');

        // max:0 over HTTP -> 400.
        const bad = await httpJson('POST', '/v1/lock', {key: 'h-zero', max: 0, ttl: 1000});
        if (bad.status !== 400) {
            fail(`POST /v1/lock max=0 should be 400, got ${bad.status}: ${JSON.stringify(bad.body)}`);
        }
        ok('POST /v1/lock max=0 -> 400');
    }

    {
        const am = await httpJson('POST', '/v1/acquire-many', {keys: ['hm-a', 'hm-b'], ttl: 5000});
        if (am.status !== 200 || !am.body?.acquired) {
            fail(`POST /v1/acquire-many failed: ${JSON.stringify(am)}`);
        }
        ok(`POST /v1/acquire-many granted lockUuid=${am.body.lockUuid?.slice(0, 8)}…`);

        const rm = await httpJson('POST', '/v1/release-many', {lockUuid: am.body.lockUuid});
        if (rm.status !== 200 || rm.body?.released !== true) {
            fail(`POST /v1/release-many failed: ${JSON.stringify(rm)}`);
        }
        ok('POST /v1/release-many released cleanly');
    }

    // ---------------------------------------------------------------
    // 6. Centralised TTL sweeper actually evicts expired holders.
    // ---------------------------------------------------------------
    console.log('\n[6] central sweeper evicts expired holders without per-holder timers');
    {
        const before = broker.ttlEvictionsTotal;
        // Acquire with a very short TTL, then drive the sweeper directly
        // so the test isn't flaky on a busy CI machine.
        const c = new Client({port: PORT});
        await c.connect();
        const lock: any = await c.acquire('ttlkey', {ttl: 50});
        if (broker['holderDeadlines'].size === 0) {
            fail('expected a deadline row to be registered after grant');
        }
        // Give the broker a window in which the deadline is definitely
        // in the past, then sweep manually.
        await new Promise(r => setTimeout(r, 80));
        broker.tickTtl(Date.now());
        if (broker.ttlEvictionsTotal <= before) {
            fail(`expected ttlEvictionsTotal to grow, was ${before}, now ${broker.ttlEvictionsTotal}`);
        }
        ok(`evicted; ttlEvictionsTotal=${before} -> ${broker.ttlEvictionsTotal}`);
        // Cleanup; the original lock is gone from the broker, so unlock
        // should be tolerated as a no-op.
        try { await c.release('ttlkey', lock.id); } catch (_) { /* expected */ }
        c.close();
    }

    // ---------------------------------------------------------------
    // Done.
    // ---------------------------------------------------------------
    await httpServer.stop();
    await new Promise<void>(r => broker.close(() => r()));

    console.log('\n✅ all improvements-test checks passed');
    process.exit(0);
}

main().catch(err => {
    console.error('improvements-test threw:', err);
    process.exit(1);
});
