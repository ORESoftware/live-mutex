'use strict';

/**
 * Regression suite for the runtime admin controls: `/admin/log-level`
 * and `/admin/tcp`, plus the HTMX-driven status-page UI.
 *
 * Asserts:
 *   1. `/admin/log-level` requires a token (401 without).
 *   2. Authenticated GET returns the current level.
 *   3. POST `{"level":"warn"}` (JSON) updates the level and reports
 *      the previous value for audit.
 *   4. Subsequent GET reflects the updated level.
 *   5. POST `{"level":"bogus"}` returns 400.
 *   6. `/admin/tcp` requires a token; GET reflects `Broker1.noDelay`;
 *      POST flips it; POST `{}` returns 400.
 *   7. `admin endpoints return HTML for HX-Request, JSON otherwise` —
 *      all three POST endpoints, both content-types (form-urlencoded
 *      + JSON), exercised in one block.
 *   8. The HTML status page:
 *        a. loads htmx from the pinned unpkg CDN URL with the exact
 *           SRI integrity hash.
 *        b. uses RELATIVE admin paths in every `hx-post` (no leading
 *           slash → works behind a gateway prefix).
 *        c. references the localStorage key `lmx-admin-token`.
 *        d. contains the form id `lmx-admin`.
 *   9. Setting `setLogLevel('silent')` suppresses subsequent
 *      `routineEnter` stdout writes; restoring to `info` re-enables
 *      them.
 */

import * as assert from 'assert';
import * as http from 'http';
import {URLSearchParams} from 'url';
import {
    Broker1,
    LMXHttpServer,
    getLogLevel,
    setLogLevel,
    routineEnter,
} from '../dist/main';

function fail(msg: string): never {
    console.error('\u274c FAIL:', msg);
    process.exit(1);
}

function ok(msg: string) {
    console.log('  \u2713', msg);
}

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: admin-controls-test took too long');
    process.exit(1);
}, 15_000);
watchdog.unref();

interface HttpReply {
    status: number;
    body: any;
    raw: string;
    contentType: string;
}

function httpReq(
    port: number,
    method: 'GET' | 'POST',
    path: string,
    headers: Record<string, string>,
    rawBody?: string,
): Promise<HttpReply> {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {method, host: '127.0.0.1', port, path, headers},
            res => {
                const chunks: Buffer[] = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => {
                    const raw = Buffer.concat(chunks as unknown as Uint8Array[]).toString('utf8');
                    const contentType = (res.headers['content-type'] || '').toString().toLowerCase();
                    let parsed: any = null;
                    if (contentType.includes('application/json')) {
                        try { parsed = JSON.parse(raw); } catch { /* leave null */ }
                    }
                    resolve({status: res.statusCode || 0, body: parsed, raw, contentType});
                });
            },
        );
        req.on('error', reject);
        if (rawBody !== undefined) req.write(rawBody);
        req.end();
    });
}

function httpJson(
    port: number,
    method: 'GET' | 'POST',
    path: string,
    headers: Record<string, string>,
    body?: any,
): Promise<HttpReply> {
    const rawBody = body !== undefined ? JSON.stringify(body) : undefined;
    const finalHeaders: Record<string, string> = {
        ...(rawBody ? {'Content-Type': 'application/json'} : {}),
        ...headers,
    };
    return httpReq(port, method, path, finalHeaders, rawBody);
}

function httpForm(
    port: number,
    method: 'POST',
    path: string,
    headers: Record<string, string>,
    fields: Record<string, string>,
): Promise<HttpReply> {
    const params = new URLSearchParams();
    for (const k of Object.keys(fields)) params.append(k, fields[k]);
    const rawBody = params.toString();
    const finalHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
    };
    return httpReq(port, method, path, finalHeaders, rawBody);
}

async function main() {
    const TOKEN = 'all-dogs-go-to-heaven';
    setLogLevel('info');

    const broker = new Broker1({noListen: true, port: 0, host: '127.0.0.1'});
    broker.emitter.on('warning', () => { /* swallow */ });
    const httpServer = new LMXHttpServer(broker, {
        port: 0,
        host: '127.0.0.1',
        enableHtmlStatus: true,
    });
    await httpServer.start();
    const port: number = (httpServer as any).server.address().port;
    if (!port) fail('HTTP server did not bind a port');

    try {
        // --- /admin/log-level (legacy JSON path) --------------------
        {
            const get401 = await httpJson(port, 'GET', '/admin/log-level', {});
            assert.strictEqual(get401.status, 401, 'GET log-level without token should be 401');
            const post401 = await httpJson(port, 'POST', '/admin/log-level', {}, {level: 'warn'});
            assert.strictEqual(post401.status, 401, 'POST log-level without token should be 401');
            ok('/admin/log-level rejects unauthenticated requests');
        }
        {
            const r = await httpJson(port, 'GET', '/admin/log-level', {'x-admin-token': TOKEN});
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.body.level, 'info', 'expected initial level to be info');
            ok('GET /admin/log-level reports current level');
        }
        {
            const r = await httpJson(
                port, 'POST', '/admin/log-level',
                {'x-admin-token': TOKEN},
                {level: 'warn'},
            );
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.body.previous, 'info');
            assert.strictEqual(r.body.level, 'warn');
            assert.strictEqual(getLogLevel(), 'warn', 'in-process log level did not flip');
            ok('POST /admin/log-level updates the level and reports previous (JSON)');
        }
        {
            const r = await httpJson(port, 'GET', '/admin/log-level', {'x-admin-token': TOKEN});
            assert.strictEqual(r.body.level, 'warn', 'subsequent GET should reflect new level');
            ok('subsequent GET reflects updated level');
        }
        {
            const r = await httpJson(
                port, 'POST', '/admin/log-level',
                {'x-admin-token': TOKEN},
                {level: 'bogus'},
            );
            assert.strictEqual(r.status, 400, 'invalid log level should return 400');
            ok('POST /admin/log-level rejects invalid level with 400');
        }
        {
            const r = await httpJson(
                port, 'POST', '/admin/log-level',
                {'x-admin-token': TOKEN},
                {},
            );
            assert.strictEqual(r.status, 400, 'missing level should return 400');
            ok('POST /admin/log-level missing field returns 400');
        }
        setLogLevel('info');

        // --- /admin/tcp ---------------------------------------------
        {
            const get401 = await httpJson(port, 'GET', '/admin/tcp', {});
            assert.strictEqual(get401.status, 401);
            const post401 = await httpJson(port, 'POST', '/admin/tcp', {}, {nodelay: false});
            assert.strictEqual(post401.status, 401);
            ok('/admin/tcp rejects unauthenticated requests');
        }
        {
            const r = await httpJson(port, 'GET', '/admin/tcp', {'x-admin-token': TOKEN});
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.body.nodelay, true, 'default broker noDelay is true');
            ok('GET /admin/tcp reports current nodelay value');
        }
        {
            const r = await httpJson(
                port, 'POST', '/admin/tcp',
                {'x-admin-token': TOKEN},
                {nodelay: false},
            );
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.body.previous, true);
            assert.strictEqual(r.body.nodelay, false);
            assert.strictEqual(broker.noDelay, false, 'broker.noDelay should be flipped');

            const back = await httpJson(
                port, 'POST', '/admin/tcp',
                {'x-admin-token': TOKEN},
                {nodelay: true},
            );
            assert.strictEqual(back.body.nodelay, true);
            assert.strictEqual(broker.noDelay, true);
            ok('POST /admin/tcp flips noDelay and round-trips');
        }
        {
            const r = await httpJson(
                port, 'POST', '/admin/tcp',
                {'x-admin-token': TOKEN},
                {},
            );
            assert.strictEqual(r.status, 400, 'empty body should be 400');
            const wrongType = await httpJson(
                port, 'POST', '/admin/tcp',
                {'x-admin-token': TOKEN},
                {nodelay: 'yes'},
            );
            assert.strictEqual(wrongType.status, 400, 'non-boolean nodelay should be 400');
            ok('POST /admin/tcp rejects missing/non-boolean nodelay with 400');
        }

        // --- admin endpoints return HTML for HX-Request, JSON otherwise
        {
            // (a) /admin/otel via HTMX (form-urlencoded + HX-Request: true)
            const r = await httpForm(
                port, 'POST', '/admin/otel',
                {'x-admin-token': TOKEN, 'HX-Request': 'true'},
                {enabled: 'true'},
            );
            assert.strictEqual(r.status, 200, 'HTMX otel POST should be 200');
            assert.ok(r.contentType.includes('text/html'),
                `HX-Request should yield text/html, got: ${r.contentType}`);
            assert.ok(/otel:\s*<strong>on<\/strong>/.test(r.raw),
                `expected HTML snippet 'otel: <strong>on</strong>', got: ${r.raw}`);
            assert.strictEqual(r.body, null, 'HX response is not JSON');

            // Flip back via HTMX too — confirm the in-process flag flipped.
            const r2 = await httpForm(
                port, 'POST', '/admin/otel',
                {'x-admin-token': TOKEN, 'HX-Request': 'true'},
                {enabled: 'false'},
            );
            assert.ok(/otel:\s*<strong>off<\/strong>/.test(r2.raw),
                `expected HTML snippet 'otel: <strong>off</strong>', got: ${r2.raw}`);

            // (b) /admin/log-level via HTMX
            const rl = await httpForm(
                port, 'POST', '/admin/log-level',
                {'x-admin-token': TOKEN, 'HX-Request': 'true'},
                {level: 'debug'},
            );
            assert.strictEqual(rl.status, 200);
            assert.ok(rl.contentType.includes('text/html'));
            assert.ok(/level:\s*<strong>debug<\/strong>/.test(rl.raw),
                `expected HTML snippet 'level: <strong>debug</strong>', got: ${rl.raw}`);
            assert.strictEqual(getLogLevel(), 'debug', 'log level should flip via HTMX form post');

            // (c) /admin/tcp via HTMX
            const rt = await httpForm(
                port, 'POST', '/admin/tcp',
                {'x-admin-token': TOKEN, 'HX-Request': 'true'},
                {nodelay: 'false'},
            );
            assert.strictEqual(rt.status, 200);
            assert.ok(rt.contentType.includes('text/html'));
            assert.ok(/nodelay:\s*<strong>off<\/strong>/.test(rt.raw),
                `expected 'nodelay: <strong>off</strong>', got: ${rt.raw}`);
            assert.strictEqual(broker.noDelay, false);

            // (d) Without HX-Request, the same form-urlencoded post
            //     still works but returns JSON (no breaking change for
            //     plain curl users sending forms).
            const rj = await httpForm(
                port, 'POST', '/admin/tcp',
                {'x-admin-token': TOKEN},
                {nodelay: 'true'},
            );
            assert.strictEqual(rj.status, 200);
            assert.ok(rj.contentType.includes('application/json'),
                `without HX-Request expected JSON, got: ${rj.contentType}`);
            assert.strictEqual(rj.body.nodelay, true);
            assert.strictEqual(rj.body.previous, false);
            ok('admin endpoints return HTML for HX-Request, JSON otherwise');
        }
        setLogLevel('info');

        // --- Status page HTMX integration ---------------------------
        {
            const r = await httpReq(port, 'GET', '/', {});
            assert.strictEqual(r.status, 200);
            // (8a) htmx loaded from unpkg with the exact pinned URL +
            //      SRI hash specified by the operator.
            assert.ok(
                r.raw.includes('src="https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js"'),
                'status page should load htmx from the pinned unpkg CDN URL',
            );
            assert.ok(
                r.raw.includes('integrity="sha384-HGfztofotfshcF7+8n44JQL2oJmowVChPTg48S+jvZoztPfvwD79OC/LTtG6dMp+"'),
                'status page should include the exact SRI integrity hash',
            );
            assert.ok(
                r.raw.includes('crossorigin="anonymous"'),
                'CDN script tag must include crossorigin="anonymous" for SRI to apply',
            );
            ok('status page loads htmx from unpkg CDN with SRI');

            // (8b) Every hx-post is a relative URL — no leading-slash.
            //      Leading slashes would bypass the `/lmx-node/`
            //      gateway prefix in production.
            assert.ok(
                !/hx-post=["']\/admin\//.test(r.raw),
                'status page must NOT use leading-slash /admin paths in hx-post (would bypass gateway prefix)',
            );
            assert.ok(
                /hx-post="admin\/otel"/.test(r.raw),
                'status page must call admin/otel via a relative path',
            );
            assert.ok(
                /hx-post="admin\/log-level"/.test(r.raw),
                'status page must call admin/log-level via a relative path',
            );
            assert.ok(
                /hx-post="admin\/tcp"/.test(r.raw),
                'status page must call admin/tcp via a relative path',
            );
            ok('status page uses relative admin paths in hx-post');

            // (8c+d) form id + localStorage key references.
            assert.ok(r.raw.includes('id="lmx-admin"'),
                'status page should contain the admin form id');
            assert.ok(r.raw.includes('lmx-admin-token'),
                'status page should reference the localStorage key');
            assert.ok(r.raw.includes('htmx:configRequest'),
                'status page should attach a configRequest handler that injects the token');
            assert.ok(r.raw.includes('meta http-equiv="refresh"'),
                'status page should still auto-refresh');
            ok('status page wires localStorage token into htmx requests');
        }

        // --- Log-level actually gates routineEnter stdout writes -----
        {
            const captured: string[] = [];
            const origWrite = process.stdout.write.bind(process.stdout) as typeof process.stdout.write;
            (process.stdout as any).write = (
                chunk: any,
                encoding?: any,
                cb?: any,
            ): boolean => {
                try {
                    const s = typeof chunk === 'string'
                        ? chunk
                        : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
                    captured.push(s);
                } catch { /* ignore */ }
                if (typeof encoding === 'function') return (origWrite as any)(chunk, encoding);
                return (origWrite as any)(chunk, encoding, cb);
            };
            try {
                setLogLevel('silent');
                captured.length = 0;
                routineEnter('ddl-routine-test-silent-Aa1', 'admin-controls-test.silent');
                const silentHits = captured.filter(s => s.includes('lmx routine:')).length;
                assert.strictEqual(silentHits, 0, 'silent should suppress routineEnter stdout');

                setLogLevel('info');
                captured.length = 0;
                routineEnter('ddl-routine-test-info-Bb2', 'admin-controls-test.info');
                const infoHits = captured.filter(s => s.includes('lmx routine:')).length;
                assert.ok(infoHits >= 1, 'info should allow routineEnter stdout');
            } finally {
                (process.stdout as any).write = origWrite;
                setLogLevel('info');
            }
            ok('setLogLevel(silent) suppresses routineEnter stdout writes');
        }

        console.log('\n\u2705 admin-controls-test: all checks passed');
    } finally {
        await httpServer.stop();
        broker.close(null);
    }
    clearTimeout(watchdog);
    process.exit(0);
}

main().catch(err => {
    console.error('FAIL:', err && err.stack || err);
    process.exit(1);
});
