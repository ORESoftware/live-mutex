'use strict';

/**
 * End-to-end smoke test against a live broker reachable on the network.
 *
 * Skipped (exits 0 with a notice) when `LMX_LIVE_BROKER_TCP` is unset
 * so it doesn't break the local `npm test` matrix. Run against any
 * deployed broker (Kubernetes Service, EC2 host, docker-compose, etc.)
 * with:
 *
 *   LMX_LIVE_BROKER_TCP=host:port \
 *   npx ts-node test/k8s-live-smoke-test.ts
 *
 * Each scenario exercises one slice of the public surface a typical
 * client relies on: TCP acquire/release with fencing-token
 * monotonicity, semaphore cap enforcement, RW read/write, and TTL
 * sweeper rescue (eviction of an abandoned holder when the client
 * socket closes without a release).
 *
 * The test does NOT assume anything about the broker's hostname
 * (so it works equally well from inside a pod via `dd-rust-network-mutex.lmx-test.svc`
 * or via `kubectl port-forward 127.0.0.1:6970`).
 */

import {Client, RWLockClient} from '../dist/main';

function envEndpoint(): {host: string; port: number} | null {
    const raw = process.env.LMX_LIVE_BROKER_TCP;
    if (!raw) return null;
    const [host, portStr] = raw.split(':');
    if (!host || !portStr) {
        process.stderr.write(`LMX_LIVE_BROKER_TCP must be host:port (got ${raw})\n`);
        process.exit(1);
    }
    return {host, port: Number(portStr)};
}

function quiet<T extends {emitter?: any}>(c: T): T {
    if (c.emitter && typeof c.emitter.on === 'function') {
        c.emitter.on('warning', () => {});
        c.emitter.on('error', () => {});
    }
    return c;
}

let scenarioCount = 0;
function ok(label: string, msg: string) {
    process.stdout.write(`  ${label}: \u2713 ${msg}\n`);
}
function fail(label: string, msg: string): never {
    process.stderr.write(`  ${label}: \u2717 ${msg}\n`);
    process.exit(1);
}

function shortSuffix(): string {
    return Math.random().toString(36).slice(2, 10);
}

async function s_acquire_release_with_fencing(host: string, port: number) {
    const label = 'live-1';
    const key = `lmx-live-acq-${shortSuffix()}`;
    const c = quiet(await new Client({host, port, lockRequestTimeout: 8_000, ttl: 5_000}).ensure());
    try {
        const a = await c.acquire(key, {ttl: 1_000, maxRetries: 1});
        if (typeof a.fencingToken !== 'number') fail(label, 'no fencing token in first grant');
        await c.release(key, a.id);
        const b = await c.acquire(key, {ttl: 1_000, maxRetries: 1});
        if (typeof b.fencingToken !== 'number') fail(label, 'no fencing token in second grant');
        if (!(b.fencingToken > a.fencingToken)) {
            fail(label, `fencing not monotonic: ${a.fencingToken} -> ${b.fencingToken}`);
        }
        await c.release(key, b.id);
        ok(label, `acquire/release fencing monotonic (${a.fencingToken} \u2192 ${b.fencingToken})`);
    } finally {
        c.close();
    }
    scenarioCount++;
}

async function s_semaphore_cap_enforced(host: string, port: number) {
    const label = 'live-2';
    const key = `lmx-live-sem-${shortSuffix()}`;
    const max = 3;

    const holders: any[] = [];
    const lockIds: string[] = [];
    for (let i = 0; i < max; i++) {
        const c = quiet(await new Client({host, port, lockRequestTimeout: 8_000, ttl: 10_000}).ensure());
        const lk = await c.acquire(key, {ttl: 5_000, max, maxRetries: 1});
        holders.push(c);
        lockIds.push(lk.id);
    }

    // (max+1)-th acquire must time out — broker queues but doesn't grant.
    // Use lockRequestTimeout=1000 with a single attempt (maxRetries=1)
    // so the probe fails fast when the broker correctly enforces the
    // cap. We don't try to release the probe's grant — if it ever
    // happens, that's a hard cap-violation failure.
    const probe = quiet(
        await new Client({host, port, lockRequestTimeout: 1_000, ttl: 5_000}).ensure(),
    );
    let probeOutcome: 'rejected' | 'granted' = 'rejected';
    let probeLockId: string | null = null;
    try {
        const got = await probe.acquire(key, {
            ttl: 5_000,
            max,
            maxRetries: 1,
            lockRequestTimeout: 1_000,
        });
        probeOutcome = 'granted';
        probeLockId = got.id;
    } catch {
        // expected
    }
    if (probeOutcome === 'granted') {
        // Defensive cleanup so we don't dangle a 4th holder.
        try { if (probeLockId) await probe.release(key, probeLockId); } catch {}
        probe.close();
        fail(label, `broker over-granted semaphore (max=${max}) — probe got a slot`);
    }
    probe.close();

    for (let i = 0; i < holders.length; i++) {
        await holders[i].release(key, lockIds[i]);
        holders[i].close();
    }
    ok(label, `semaphore cap=${max} held under contention`);
    scenarioCount++;
}

async function s_rw_read_then_write(host: string, port: number) {
    const label = 'live-3';
    const suffix = shortSuffix();
    // RWLockClient.beginRead requires a paired writeKey. The two keys
    // form the read/write coordination pair: readers acquire `key`
    // shared, while a writer holds `writeKey` exclusively.
    const readKey = `lmx-live-rw-r-${suffix}`;
    const writeKey = `lmx-live-rw-w-${suffix}`;
    // The RWLockClient promise helpers (`beginReadp`/`beginWritep`) are
    // defined on the subclass but `ensure()` is typed as returning the
    // base `Client`, so we cast to `any` here rather than fighting the
    // declared shape.
    const rw: any = quiet(
        await new RWLockClient({host, port, lockRequestTimeout: 8_000, ttl: 5_000}).ensure(),
    );
    try {
        const r = await rw.beginReadp(readKey, {writeKey, ttl: 1_000, maxRetries: 1});
        await rw.endReadp(readKey, {writeKey, id: r.id});
        const w = await rw.beginWritep(writeKey, {ttl: 1_000, maxRetries: 1});
        await rw.endWritep(writeKey, {id: w.id});
        ok(label, 'RW read (readKey/writeKey pair) then write completed');
    } finally {
        rw.close();
    }
    scenarioCount++;
}

async function s_disconnect_releases_holder(host: string, port: number) {
    const label = 'live-4';
    const key = `lmx-live-disc-${shortSuffix()}`;

    // Holder acquires, then closes its socket without releasing. A
    // recovery client should be able to acquire shortly after.
    const holder = quiet(
        await new Client({host, port, lockRequestTimeout: 5_000, ttl: 30_000}).ensure(),
    );
    const lk = await holder.acquire(key, {ttl: 30_000, maxRetries: 1});
    void lk;
    holder.close();

    // Use a forgiving retry budget to absorb the broker's drop-client
    // sweep latency on the network path.
    const recover = quiet(
        await new Client({host, port, lockRequestTimeout: 8_000, ttl: 5_000}).ensure(),
    );
    try {
        const got = await recover.acquire(key, {ttl: 1_000, maxRetries: 5});
        await recover.release(key, got.id);
        ok(label, 'broker reaped holder after socket close, recover client acquired');
    } finally {
        recover.close();
    }
    scenarioCount++;
}

(async () => {
    const ep = envEndpoint();
    if (!ep) {
        process.stdout.write('LMX_LIVE_BROKER_TCP not set — skipping k8s live smoke\n');
        process.exit(0);
    }
    process.stdout.write(`live broker: ${ep.host}:${ep.port}\n`);
    const watchdog = setTimeout(() => {
        process.stderr.write('k8s-live-smoke watchdog: total runtime exceeded budget\n');
        process.exit(1);
    }, 60_000);
    watchdog.unref();

    const scenarios: Array<[string, (h: string, p: number) => Promise<void>]> = [
        ['live-1', s_acquire_release_with_fencing],
        ['live-2', s_semaphore_cap_enforced],
        ['live-3', s_rw_read_then_write],
        ['live-4', s_disconnect_releases_holder],
    ];
    for (const [name, fn] of scenarios) {
        try {
            await fn(ep.host, ep.port);
        } catch (err: any) {
            process.stderr.write(`scenario ${name} threw: ${err && err.stack || err}\n`);
            process.exit(1);
        }
    }
    process.stdout.write(`\n\u2705 k8s-live-smoke-test: all ${scenarioCount} scenarios passed\n`);
    clearTimeout(watchdog);
    process.exit(0);
})().catch(err => {
    process.stderr.write(`top-level: ${err && err.stack || err}\n`);
    process.exit(1);
});
