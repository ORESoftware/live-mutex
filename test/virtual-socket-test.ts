'use strict';

/**
 * Lifecycle + async-semantics regression tests for `VirtualSocket`,
 * the in-process stand-in for `net.Socket` that backs every
 * `InProcessBridge`.
 *
 * The previous implementation called `onFrame` *synchronously* inside
 * `write()`. That meant the bridge's awaiter could resume mid-broker
 * handler and observe state the broker hadn't finished mutating. Real
 * `net.Socket` always crosses at least one tick between sender's
 * `write()` and receiver's `'data'` event; this suite locks in that
 * we now do the same, and also pins down the documented
 * lifecycle-ordering contract (`finish` -> `end` -> `close` for
 * `end()`; `error` -> `close` for `destroy(err)`; both flows
 * idempotent).
 *
 * Asserts:
 *   1. `write()` schedules `onFrame` on a future tick — never
 *      synchronously inside the same call.
 *   2. Multiple frames in one buffer arrive at `onFrame` in FIFO
 *      order on the next tick.
 *   3. `bytesWritten` and `bytesRead` track byte counts.
 *   4. `write()` after `destroy()` returns `false` and fires the
 *      callback with `ERR_STREAM_DESTROYED` on `nextTick`.
 *   5. `write()` accepts `string | Buffer | Uint8Array`.
 *   6. `destroy()` is idempotent (a second call is a no-op and does
 *      NOT re-emit `'close'`).
 *   7. `destroy(err)` emits `'error'` THEN `'close'(true)` on
 *      `nextTick`.
 *   8. `end()` emits `'finish'` -> `'end'` -> `'close'(false)` in
 *      that order.
 *   9. `end()` is idempotent.
 *  10. `address()` returns a `net.Server`-compatible shape.
 *  11. `readyState` transitions through `open` -> `closed` cleanly.
 *  12. Tuning no-ops (`setNoDelay`, `setKeepAlive`, `setTimeout`,
 *      `setEncoding`, `unref`, `ref`, `pause`, `resume`) return
 *      `this` (chainable, like real net.Socket).
 *  13. `pipe(target)` returns `target` so
 *      `ws.pipe(parser).on('data', cb)` keeps working.
 *  14. The LMXSocket extension fields (`lmxClosed`, `destroyTimeout`)
 *      exist with the right initial values.
 *  15. End-to-end through the bridge: `await bridge.lock(...)`
 *      resolves only AFTER the broker's lock-handler has fully
 *      returned (proves the awaiter never observes mid-handler state).
 *  16. FIFO is preserved across multiple separate `write()` calls
 *      (cross-write order, not just within-buffer order).
 *  17. Malformed JSON in `write()` is dropped silently (no error
 *      emit, no callback rejection, surrounding valid frames still
 *      flow).
 *  18. `write('')` and `write('\n\n')` deliver no frames, no errors.
 *  19. `onFrame` throwing emits an `'error'` event on the socket
 *      and does NOT block subsequent frame delivery.
 *  20. `end(payload)` writes the trailing payload (delivered to
 *      `onFrame`) BEFORE running the `finish` -> `end` -> `close`
 *      lifecycle, and `end()`'s callback fires after close.
 *  21. `removeAllListeners('event')` is selective — only that
 *      event's listeners are removed; siblings survive.
 *  22. The LMX-extension `destroyTimeout` field is assignable and
 *      reassignable (broker version-mismatch flow stores + clears
 *      a Timer here).
 *  23. Bridge integration: `bridge.shutdown()` rejects every
 *      in-flight awaiter with `InProcessBridge: shutdown` (not a
 *      dispatch timeout), and post-shutdown `bridge.lock()` rejects
 *      synchronously with `InProcessBridge: closed`.
 *
 * Self-times-out at 8s. Any hang means a callback didn't fire or a
 * lifecycle event went missing.
 */

import * as assert from 'assert';
import {Broker1, InProcessBridge, VirtualSocket} from '../dist/main';

function fail(msg: string): never {
    console.error('\u274c FAIL:', msg);
    process.exit(1);
}

function ok(msg: string) {
    console.log('  \u2713', msg);
}

const watchdog = setTimeout(() => {
    console.error('\u274c TIMEOUT: virtual-socket-test took too long');
    process.exit(1);
}, 8_000);
watchdog.unref();

function nextTick(): Promise<void> {
    return new Promise(r => process.nextTick(r));
}

function tickTwice(): Promise<void> {
    return new Promise(r => process.nextTick(() => process.nextTick(r)));
}

async function main() {
    // ===========================================================
    // [1] write() schedules onFrame on a future tick (NOT sync)
    // ===========================================================
    console.log('[1] onFrame is async — never fires inside write()');
    {
        const frames: any[] = [];
        const sock = new VirtualSocket(f => frames.push(f));
        const writeReturned = sock.write('{"a":1}\n');
        if (writeReturned !== true) fail(`write should return true; got ${writeReturned}`);
        const lenBeforeTick = frames.length;
        if (lenBeforeTick !== 0) {
            fail(`onFrame fired synchronously inside write() — saw ${lenBeforeTick} frames`);
        }
        await nextTick();
        const lenAfterTick = frames.length;
        if (lenAfterTick !== 1) fail(`expected 1 frame after one tick; got ${lenAfterTick}`);
        if (frames[0].a !== 1) fail(`bad frame payload: ${JSON.stringify(frames[0])}`);
        ok('onFrame deferred to next tick (not sync)');
    }

    // ===========================================================
    // [2] Multiple frames in one buffer arrive in FIFO order
    // ===========================================================
    console.log('\n[2] multiple frames arrive in FIFO order on next tick');
    {
        const frames: any[] = [];
        const sock = new VirtualSocket(f => frames.push(f));
        sock.write('{"i":0}\n{"i":1}\n{"i":2}\n');
        const lenBefore = frames.length;
        if (lenBefore !== 0) fail('frames delivered synchronously');
        await tickTwice();
        const lenAfter = frames.length;
        if (lenAfter !== 3) fail(`expected 3 frames; got ${lenAfter}`);
        for (let i = 0; i < 3; i++) {
            if (frames[i].i !== i) fail(`frame order broken at ${i}: ${JSON.stringify(frames)}`);
        }
        ok(`3 frames arrived in order: ${frames.map(f => f.i).join(',')}`);
    }

    // ===========================================================
    // [3] bytesWritten / bytesRead are tracked
    // ===========================================================
    console.log('\n[3] bytes counters track byte counts');
    {
        const sock = new VirtualSocket(() => {});
        const a = '{"x":1}\n';
        const b = '{"y":2}\n';
        sock.write(a);
        sock.write(Buffer.from(b, 'utf8'));
        if (sock.bytesWritten !== Buffer.byteLength(a) + Buffer.byteLength(b)) {
            fail(`bytesWritten=${sock.bytesWritten}, expected ${Buffer.byteLength(a) + Buffer.byteLength(b)}`);
        }
        await tickTwice();
        // bytesRead counts each delivered frame's parsed line.length + 1 (newline).
        if (sock.bytesRead === 0) fail('bytesRead never incremented');
        ok(`bytesWritten=${sock.bytesWritten}, bytesRead=${sock.bytesRead}`);
    }

    // ===========================================================
    // [4] write() after destroy() returns false + cb gets err
    // ===========================================================
    console.log('\n[4] write() after destroy() rejects with ERR_STREAM_DESTROYED');
    {
        const sock = new VirtualSocket(() => {});
        sock.destroy();
        let cbErr: any = 'NOT-CALLED';
        const ret = sock.write('{"a":1}\n', 'utf8', err => { cbErr = err; });
        if (ret !== false) fail(`write after destroy should return false; got ${ret}`);
        await nextTick();
        if (!cbErr || cbErr === 'NOT-CALLED') fail('write callback was not invoked after destroy');
        if ((cbErr as any).code !== 'ERR_STREAM_DESTROYED') {
            fail(`expected ERR_STREAM_DESTROYED, got code=${(cbErr as any).code} msg=${(cbErr as any).message}`);
        }
        ok(`got ${cbErr.code}: ${cbErr.message}`);
    }

    // ===========================================================
    // [5] write() accepts string | Buffer | Uint8Array
    // ===========================================================
    console.log('\n[5] write() accepts string, Buffer, and Uint8Array');
    {
        const frames: any[] = [];
        const sock = new VirtualSocket(f => frames.push(f));
        sock.write('{"src":"string"}\n');
        sock.write(Buffer.from('{"src":"buffer"}\n', 'utf8'));
        // Plain Uint8Array (NOT a Buffer) to exercise the third branch.
        const u8src = '{"src":"u8"}\n';
        const u8 = new Uint8Array(Buffer.byteLength(u8src));
        for (let i = 0; i < u8src.length; i++) u8[i] = u8src.charCodeAt(i);
        sock.write(u8);
        await tickTwice();
        const sources = frames.map(f => f.src).sort();
        assert.deepStrictEqual(sources, ['buffer', 'string', 'u8']);
        ok(`got 3 frames from 3 input shapes: ${sources.join(',')}`);
    }

    // ===========================================================
    // [6] destroy() is idempotent — second call is a no-op
    // ===========================================================
    console.log('\n[6] destroy() is idempotent');
    {
        const sock = new VirtualSocket(() => {});
        let closeCount = 0;
        sock.on('close', () => { closeCount++; });
        sock.destroy();
        sock.destroy(); // second call must NOT re-emit close
        await tickTwice();
        const observed = closeCount;
        if (observed !== 1) fail(`expected 1 close emit; got ${observed}`);
        if (!sock.destroyed) fail('destroyed flag not set');
        if (sock.writable !== false) fail('writable should be false after destroy');
        if (sock.readable !== false) fail('readable should be false after destroy');
        if (sock.lmxClosed !== true) fail('lmxClosed should be true (LMX-extension contract)');
        ok('second destroy() was a no-op; close fired exactly once');
    }

    // ===========================================================
    // [7] destroy(err) emits error THEN close(true) on nextTick
    // ===========================================================
    console.log('\n[7] destroy(err) emits error -> close(true) async');
    {
        const sock = new VirtualSocket(() => {});
        const events: Array<{name: string, payload?: any}> = [];
        sock.on('error', e => events.push({name: 'error', payload: e}));
        sock.on('close', hadError => events.push({name: 'close', payload: hadError}));
        const myErr = new Error('boom');
        sock.destroy(myErr);
        // SYNC observation: nothing emitted yet.
        const beforeLen = events.length;
        if (beforeLen !== 0) fail(`events fired sync inside destroy(): ${JSON.stringify(events)}`);
        await nextTick();
        const afterLen = events.length;
        if (afterLen !== 2) fail(`expected 2 events; got ${afterLen}: ${events.map(e => e.name).join(',')}`);
        if (events[0].name !== 'error') fail(`first event should be error; got ${events[0].name}`);
        if (events[0].payload !== myErr) fail('error event did not carry the supplied Error instance');
        if (events[1].name !== 'close') fail(`second event should be close; got ${events[1].name}`);
        if (events[1].payload !== true) fail(`close hadError should be true; got ${events[1].payload}`);
        ok('error -> close(true) order preserved');
    }

    // ===========================================================
    // [8] end() emits finish -> end -> close(false) in order
    // ===========================================================
    console.log('\n[8] end() emits finish -> end -> close(false) in order');
    {
        const sock = new VirtualSocket(() => {});
        const events: string[] = [];
        sock.on('finish', () => events.push('finish'));
        sock.on('end', () => events.push('end'));
        sock.on('close', hadError => events.push(`close(${hadError})`));
        sock.end();
        const lenA = events.length;
        if (lenA !== 0) fail(`end() emitted events synchronously: ${events}`);
        // Wait enough ticks for finalize (2 nextTicks: finalize body + close).
        await tickTwice();
        await nextTick();
        const lenB = events.length;
        if (lenB !== 3) fail(`expected 3 events; got ${lenB}: ${events}`);
        assert.deepStrictEqual(events, ['finish', 'end', 'close(false)'],
            `expected lifecycle order; got ${JSON.stringify(events)}`);
        ok(`got ${events.join(' -> ')}`);
    }

    // ===========================================================
    // [9] end() is idempotent
    // ===========================================================
    console.log('\n[9] end() is idempotent');
    {
        const sock = new VirtualSocket(() => {});
        let closeCount = 0;
        let finishCount = 0;
        sock.on('finish', () => finishCount++);
        sock.on('close', () => closeCount++);
        sock.end();
        sock.end();   // second end() must not re-fire finish/close
        sock.end();   // third end() either
        await tickTwice();
        await nextTick();
        if (finishCount !== 1) fail(`finish fired ${finishCount} times`);
        if (closeCount !== 1) fail(`close fired ${closeCount} times`);
        ok('finish + close each fired exactly once across 3 end() calls');
    }

    // ===========================================================
    // [10] address() shape
    // ===========================================================
    console.log('\n[10] address() returns net.Socket-compatible shape');
    {
        const sock = new VirtualSocket(() => {});
        const a = sock.address();
        if (typeof a.address !== 'string') fail('address.address must be string');
        if (typeof a.family !== 'string') fail('address.family must be string');
        if (typeof a.port !== 'number') fail('address.port must be number');
        ok(`address()=${JSON.stringify(a)}`);
    }

    // ===========================================================
    // [11] readyState transitions
    // ===========================================================
    console.log('\n[11] readyState transitions cleanly');
    {
        const sock = new VirtualSocket(() => {});
        const initial: string = sock.readyState;
        if (initial !== 'open') fail(`initial readyState: ${initial}`);
        sock.destroy();
        const final: string = sock.readyState;
        if (final !== 'closed') fail(`post-destroy readyState: ${final}`);
        ok('open -> closed');
    }

    // ===========================================================
    // [12] Tuning no-ops are chainable (return this)
    // ===========================================================
    console.log('\n[12] tuning no-ops are chainable (mirror net.Socket)');
    {
        const sock = new VirtualSocket(() => {});
        const r1 = sock.setNoDelay(true);
        const r2 = sock.setKeepAlive(true, 1000);
        const r3 = sock.setTimeout(5000);
        const r4 = sock.setEncoding('utf8');
        const r5 = sock.unref();
        const r6 = sock.ref();
        const r7 = sock.pause();
        const r8 = sock.resume();
        for (const [name, ret] of [
            ['setNoDelay', r1], ['setKeepAlive', r2], ['setTimeout', r3],
            ['setEncoding', r4], ['unref', r5], ['ref', r6],
            ['pause', r7], ['resume', r8],
        ] as const) {
            if (ret !== sock) fail(`${name}() should return this; got ${ret}`);
        }
        if (sock.timeout !== 5000) fail(`setTimeout did not capture value; got ${sock.timeout}`);
        ok('all 8 tuning methods returned this; setTimeout captured value');
    }

    // ===========================================================
    // [13] pipe(target) returns target
    // ===========================================================
    console.log('\n[13] pipe(target) returns target');
    {
        const sock = new VirtualSocket(() => {});
        const fakeParser = {parserId: 'p1'};
        const out = sock.pipe(fakeParser);
        if (out !== fakeParser) fail('pipe did not return its argument');
        ok('pipe returns its target so .pipe(parser).on(...) chaining works');
    }

    // ===========================================================
    // [14] LMX extension fields exist with right initial values
    // ===========================================================
    console.log('\n[14] LMX extension fields are present');
    {
        const sock = new VirtualSocket(() => {});
        if (sock.lmxClosed !== false) fail(`lmxClosed initial: ${sock.lmxClosed}`);
        if (typeof sock.destroyTimeout !== 'undefined') fail(`destroyTimeout initial: ${sock.destroyTimeout}`);
        // Broker code mutates these.
        sock.destroyTimeout = setTimeout(() => {}, 60_000) as any;
        sock.destroyTimeout && clearTimeout(sock.destroyTimeout);
        ok('lmxClosed=false, destroyTimeout=undefined; both writable');
    }

    // ===========================================================
    // [15] End-to-end through the bridge: await resolves only AFTER
    //      the broker's lock-handler has fully returned. This proves
    //      the async-onFrame fix prevents mid-handler observations.
    // ===========================================================
    console.log('\n[15] bridge awaiter resumes only after broker handler returns');
    {
        const broker = new Broker1({noListen: true, port: 0, host: '127.0.0.1'});
        broker.emitter.on('warning', () => {});

        const bridge = new InProcessBridge(broker);

        // Sentinel: monkey-patch broker.lock to set a flag AFTER it
        // finishes its synchronous bookkeeping. If the awaiter ever
        // resumes before the flag is set, we know onFrame fired
        // synchronously inside the broker's send call.
        const realLock = broker.lock.bind(broker);
        let handlerFinished = false;
        let observedAtAwaiter: boolean | null = null;
        (broker as any).lock = (payload: any, ws: any) => {
            handlerFinished = false;
            const r = realLock(payload, ws);
            handlerFinished = true;
            return r;
        };

        // Race the awaiter against the handler-finished flag.
        const p = bridge.lock({key: 'sentinel', ttl: 5_000}).then((reply: any) => {
            observedAtAwaiter = handlerFinished;
            return reply;
        });

        const reply: any = await p;
        if (reply.acquired !== true) fail(`expected acquired:true, got ${JSON.stringify(reply)}`);
        if (observedAtAwaiter !== true) {
            fail(`bridge awaiter resumed BEFORE broker.lock fully returned (handlerFinished=${observedAtAwaiter})`);
        }
        ok('awaiter observed handlerFinished=true (no mid-handler observation)');

        // Sanity: bridge ownership cleanup still works.
        await bridge.unlock({key: 'sentinel', lockUuid: reply._bridgeRequestUuid});
        bridge.shutdown();
        await new Promise<void>(r => broker.close(() => r()));
    }

    // ===========================================================
    // [16] Cross-write FIFO: frames from N separate write() calls
    //      are delivered to onFrame in the order written.
    // ===========================================================
    console.log('\n[16] FIFO is preserved across multiple write() calls');
    {
        const frames: any[] = [];
        const sock = new VirtualSocket(f => frames.push(f));
        for (let i = 0; i < 25; i++) {
            sock.write(`{"i":${i}}\n`);
        }
        const lenA = frames.length;
        if (lenA !== 0) fail(`frames delivered sync inside write loop (got ${lenA})`);
        await new Promise<void>(r => setImmediate(r));
        const lenB = frames.length;
        if (lenB !== 25) fail(`expected 25 frames; got ${lenB}`);
        for (let i = 0; i < 25; i++) {
            if (frames[i].i !== i) {
                fail(`order broken at index ${i}; got ${JSON.stringify(frames.map(f => f.i))}`);
            }
        }
        ok('25 frames from 25 separate write() calls delivered in order');
    }

    // ===========================================================
    // [17] Malformed JSON in write() is dropped silently — does
    //      NOT crash, does NOT reject the write callback, does NOT
    //      emit 'error', does NOT block surrounding valid frames.
    // ===========================================================
    console.log('\n[17] malformed JSON frames are dropped silently');
    {
        const frames: any[] = [];
        const errs: any[] = [];
        const sock = new VirtualSocket(f => frames.push(f));
        sock.on('error', e => errs.push(e));
        let cbErr: any = 'NOT-CALLED';
        sock.write(
            'not json at all\n' +
            '{"valid":1}\n' +
            'totally bogus {trailing\n' +
            '{"valid":2}\n',
            'utf8',
            err => { cbErr = err; },
        );
        await new Promise<void>(r => setImmediate(r));
        if (cbErr !== null) fail(`write cb should fire with null on success; got ${cbErr}`);
        if (errs.length !== 0) fail(`unexpected 'error' emit: ${errs.map(e => e.message).join(', ')}`);
        if (frames.length !== 2) fail(`expected 2 valid frames; got ${frames.length}`);
        if (frames[0].valid !== 1 || frames[1].valid !== 2) {
            fail(`bad valid frames: ${JSON.stringify(frames)}`);
        }
        ok(`bogus lines silently dropped; 2 valid frames preserved`);
    }

    // ===========================================================
    // [18] write('') and write('\n\n\n') deliver no frames and
    //      cause no errors. The broker never writes empty frames
    //      but the surface should be tolerant.
    // ===========================================================
    console.log('\n[18] empty / newline-only writes deliver no frames');
    {
        const frames: any[] = [];
        const errs: any[] = [];
        const sock = new VirtualSocket(f => frames.push(f));
        sock.on('error', e => errs.push(e));
        sock.write('');
        sock.write('\n');
        sock.write('\n\n\n\n');
        await new Promise<void>(r => setImmediate(r));
        if (frames.length !== 0) fail(`expected 0 frames; got ${frames.length}`);
        if (errs.length !== 0) fail(`unexpected error emits: ${errs.map(e => e.message).join(', ')}`);
        ok('no frames delivered, no errors emitted');
    }

    // ===========================================================
    // [19] onFrame throwing emits an 'error' event on the socket
    //      and does NOT crash the process or stall further frames.
    // ===========================================================
    console.log('\n[19] onFrame throwing -> error event, surrounding frames still flow');
    {
        let throwOnNext = true;
        const seen: any[] = [];
        const errs: any[] = [];
        const sock = new VirtualSocket(f => {
            if (throwOnNext) {
                throwOnNext = false;
                throw new Error('boom-in-onFrame');
            }
            seen.push(f);
        });
        sock.on('error', e => errs.push(e));
        sock.write('{"a":1}\n');  // this one throws inside onFrame
        sock.write('{"a":2}\n');  // this one is fine
        await new Promise<void>(r => setImmediate(r));
        if (errs.length !== 1) fail(`expected 1 error emit; got ${errs.length}`);
        if (!errs[0] || !String(errs[0].message).includes('boom-in-onFrame')) {
            fail(`unexpected error: ${errs[0]?.message}`);
        }
        if (seen.length !== 1 || seen[0].a !== 2) {
            fail(`expected the second frame to still arrive; got ${JSON.stringify(seen)}`);
        }
        ok(`error event fired with original Error; subsequent frame still delivered`);
    }

    // ===========================================================
    // [20] end(payload) drains the trailing write THEN runs the
    //      finish -> end -> close lifecycle in order.
    // ===========================================================
    console.log('\n[20] end(payload) delivers trailing frame BEFORE close');
    {
        const frames: any[] = [];
        const events: string[] = [];
        const sock = new VirtualSocket(f => {
            frames.push(f);
            events.push(`frame#${(f as any).n}`);
        });
        sock.on('finish', () => events.push('finish'));
        sock.on('end', () => events.push('end'));
        sock.on('close', () => events.push('close'));

        let endCbFired = false;
        sock.end('{"n":1}\n', 'utf8', () => { endCbFired = true; });

        await new Promise<void>(r => setImmediate(r));
        await new Promise<void>(r => setImmediate(r)); // an extra macrotask for safety

        if (!endCbFired) fail('end() callback did not fire');
        if (frames.length !== 1) fail(`expected 1 trailing frame; got ${frames.length}`);
        if (frames[0].n !== 1) fail(`bad trailing frame: ${JSON.stringify(frames[0])}`);
        // Frame must arrive BEFORE finish/end/close.
        const frameIdx = events.indexOf('frame#1');
        const finishIdx = events.indexOf('finish');
        const closeIdx = events.indexOf('close');
        if (frameIdx === -1 || finishIdx === -1 || closeIdx === -1) {
            fail(`missing event in stream: ${events}`);
        }
        if (!(frameIdx < finishIdx && finishIdx < closeIdx)) {
            fail(`out-of-order: ${events}`);
        }
        if (sock.destroyed !== true) fail('socket should be destroyed after end()');
        ok(`trailing frame -> finish -> end -> close in order: ${events}`);
    }

    // ===========================================================
    // [21] removeAllListeners('event') is selective — only that
    //      event's listeners are removed, others survive.
    // ===========================================================
    console.log('\n[21] removeAllListeners(event) is selective');
    {
        const sock = new VirtualSocket(() => {});
        let aCount = 0;
        let bCount = 0;
        sock.on('a', () => { aCount++; });
        sock.on('a', () => { aCount++; });
        sock.on('b', () => { bCount++; });
        sock.removeAllListeners('a');
        sock.emit('a');
        sock.emit('a');
        sock.emit('b');
        if (aCount !== 0) fail(`'a' listeners should be gone; saw aCount=${aCount}`);
        if (bCount !== 1) fail(`'b' listener should fire once; saw bCount=${bCount}`);
        ok(`'a' listeners removed; 'b' listener intact`);
    }

    // ===========================================================
    // [22] destroyTimeout (LMX-extension) is assignable + clearable
    //      — broker version-mismatch flow stores a Timer here, then
    //      clears it on receiving the version-mismatch ack.
    // ===========================================================
    console.log('\n[22] destroyTimeout LMX extension behaves');
    {
        const sock = new VirtualSocket(() => {});
        if (sock.destroyTimeout !== undefined) fail(`initial destroyTimeout: ${sock.destroyTimeout}`);
        const t = setTimeout(() => {}, 60_000);
        sock.destroyTimeout = t;
        if (sock.destroyTimeout !== t) fail('destroyTimeout assignment did not stick');
        clearTimeout(sock.destroyTimeout);
        sock.destroyTimeout = undefined;
        if (sock.destroyTimeout !== undefined) fail('destroyTimeout reset failed');
        ok('destroyTimeout: undefined -> Timer -> undefined transitions');
    }

    // ===========================================================
    // [23] Bridge: shutdown() rejects all in-flight awaiters with a
    //      clear error. Locks an idle broker by stubbing
    //      broker.lock to never-reply, then asserts every awaiter
    //      gets `InProcessBridge: shutdown` (not the dispatch
    //      timeout — shutdown should win the race even with the
    //      default 60s timeout still ticking).
    // ===========================================================
    console.log('\n[23] bridge.shutdown() rejects all in-flight awaiters');
    {
        const broker = new Broker1({noListen: true, port: 0, host: '127.0.0.1'});
        broker.emitter.on('warning', () => {});
        const bridge = new InProcessBridge(broker);

        // Stub lock/unlock/etc to be no-ops so requests pend forever.
        (broker as any).lock = () => {};
        (broker as any).unlock = () => {};
        (broker as any).acquireMany = () => {};
        (broker as any).releaseMany = () => {};

        const promises = [
            bridge.lock({key: 'p-1', ttl: 5000}),
            bridge.lock({key: 'p-2', ttl: 5000}),
            bridge.acquireMany(['x', 'y'], 5000),
            bridge.releaseMany('fake-uuid'),
            bridge.unlock({key: 'p-3'}),
        ];

        const pendingNow = bridge.pendingCount;
        if (pendingNow !== promises.length) {
            fail(`pendingCount=${pendingNow}, expected ${promises.length}`);
        }
        ok(`pendingCount=${pendingNow} before shutdown`);

        bridge.shutdown();

        const settled = await Promise.allSettled(promises);
        for (let i = 0; i < settled.length; i++) {
            const s = settled[i];
            if (s.status !== 'rejected') {
                fail(`promise[${i}] resolved instead of rejecting: ${JSON.stringify((s as any).value)}`);
            }
            const msg = String((s as any).reason?.message ?? s.reason);
            if (!msg.includes('shutdown')) {
                fail(`promise[${i}] rejected with non-shutdown error: ${msg}`);
            }
        }
        if (bridge.pendingCount !== 0) fail(`pendingCount=${bridge.pendingCount} after shutdown`);
        ok(`all ${promises.length} pending awaiters rejected with 'shutdown' error; pendingCount=0`);

        // Sanity: a NEW dispatch on a closed bridge should reject
        // immediately with `InProcessBridge: closed`, not pend.
        try {
            await bridge.lock({key: 'after-shutdown', ttl: 1000});
            fail('expected lock-after-shutdown to reject');
        } catch (err: any) {
            if (!String(err.message).includes('closed')) {
                fail(`expected 'closed'; got ${err.message}`);
            }
            ok('post-shutdown dispatch rejects with InProcessBridge: closed');
        }

        await new Promise<void>(r => broker.close(() => r()));
    }

    clearTimeout(watchdog);
    console.log('\n\u2705 virtual-socket-test: all 23 checks passed');
    process.exit(0);
}

main().catch(err => {
    console.error('virtual-socket-test threw:', err);
    process.exit(1);
});
