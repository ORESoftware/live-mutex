'use strict';

import * as assert from 'assert';
import {Broker1, MAX_FENCING_TOKEN, setLogLevel} from '../dist/main';
import {v4 as uuidV4} from 'uuid';

setLogLevel('error');

interface FakeSocket {
  writable: boolean;
  lmxClosed: boolean;
  sent: any[];
  cursor: number;
  write(chunk: any): boolean;
  end(): void;
  destroy(): void;
  on(): void;
  removeAllListeners(): void;
}

function socket(): FakeSocket {
  const sent: any[] = [];
  return {
    writable: true,
    lmxClosed: false,
    sent,
    cursor: 0,
    write(chunk: any) {
      for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
        sent.push(JSON.parse(line));
      }
      return true;
    },
    end() {},
    destroy() {},
    on() {},
    removeAllListeners() {},
  };
}

function frames(ws: FakeSocket): any[] {
  const out = ws.sent.slice(ws.cursor);
  ws.cursor = ws.sent.length;
  return out;
}

async function broker(): Promise<Broker1> {
  const b = new Broker1({noListen: true} as any);
  b.emitter.on('warning', () => {});
  await b.ensure();
  return b;
}

function acquire(b: Broker1, ws: FakeSocket, key: string) {
  const uuid = uuidV4();
  b.lock({
    uuid,
    key,
    pid: process.pid,
    ttl: 120_000,
    wait: false,
    force: false,
    retryCount: 0,
    keepLocksAfterDeath: false,
  } as any, ws as any);
  const reply = frames(ws).find((m) => m.type === 'lock' && m.uuid === uuid);
  assert.ok(reply, `missing lock reply for ${key}`);
  return {uuid, reply};
}

function release(b: Broker1, ws: FakeSocket, key: string, holderUuid: string) {
  b.unlock({uuid: uuidV4(), key, _uuid: holderUuid, force: false} as any, ws as any);
  frames(ws);
}

async function watermarkSurvivesKeyGcAndClockRollback() {
  const originalNow = Date.now;
  let now = 10_000_000;
  Date.now = () => now;
  const b = await broker();
  const ws = socket();
  try {
    const first = acquire(b, ws, 'gc-fence');
    assert.equal(first.reply.acquired, true);
    const token1 = first.reply.fencingToken;
    assert.ok(Number.isSafeInteger(token1) && token1 > 0);
    release(b, ws, 'gc-fence', first.uuid);

    const old = (b as any).locks.get('gc-fence');
    assert.ok(old, 'lock object should exist before idle cleanup');
    old.timestampEmptied = now - 5_000;
    b.cleanUpLocks();
    assert.equal((b as any).locks.has('gc-fence'), false, 'idle-key GC should remove the LockObj');

    // Simulate a severe wall-clock rollback. Authority must still be derived
    // from the broker watermark, not from the new lower Date.now().
    now = 1_000;
    const second = acquire(b, ws, 'gc-fence');
    assert.equal(second.reply.acquired, true);
    assert.ok(second.reply.fencingToken > token1,
      `recreated key regressed fencing authority: ${second.reply.fencingToken} <= ${token1}`);
    assert.ok(b.getFencingWatermark() >= second.reply.fencingToken);
    release(b, ws, 'gc-fence', second.uuid);
  } finally {
    Date.now = originalNow;
    b.stopTtlSweeper();
  }
}

async function durableRestartFloorDominatesWallClock() {
  const previous = process.env.LMX_FENCING_TOKEN_FLOOR;
  process.env.LMX_FENCING_TOKEN_FLOOR = '5000000000000000';
  const b = await broker();
  const ws = socket();
  try {
    const grant = acquire(b, ws, 'restart-floor');
    assert.equal(grant.reply.acquired, true);
    assert.equal(grant.reply.fencingToken, 5_000_000_000_000_001);
    assert.equal(b.getFencingWatermark(), grant.reply.fencingToken);
    release(b, ws, 'restart-floor', grant.uuid);
  } finally {
    b.stopTtlSweeper();
    if (previous === undefined) delete process.env.LMX_FENCING_TOKEN_FLOOR;
    else process.env.LMX_FENCING_TOKEN_FLOOR = previous;
  }
}

async function exhaustionFailsClosedWithoutPartialComposite() {
  const previous = process.env.LMX_FENCING_TOKEN_FLOOR;
  process.env.LMX_FENCING_TOKEN_FLOOR = String(MAX_FENCING_TOKEN - 1);
  const b = await broker();
  const ws = socket();
  try {
    // Two-key acquisition would need two fresh authority values. Only one is
    // available, so the request must fail before either member is installed.
    const requestUuid = uuidV4();
    b.acquireMany({
      type: 'acquire-many',
      uuid: requestUuid,
      keys: ['exhaust-a', 'exhaust-b'],
      ttl: 120_000,
      wait: false,
      pid: process.pid,
    } as any, ws as any);
    const many = frames(ws).find((m) => m.type === 'acquire-many' && m.uuid === requestUuid);
    assert.ok(many);
    assert.equal(many.acquired, false);
    assert.equal(many.error, 'fencing_token_exhausted');
    assert.equal((b as any).locks.has('exhaust-a'), false);
    assert.equal((b as any).locks.has('exhaust-b'), false);

    // The final single token remains usable exactly once.
    const finalGrant = acquire(b, ws, 'final-token');
    assert.equal(finalGrant.reply.acquired, true);
    assert.equal(finalGrant.reply.fencingToken, MAX_FENCING_TOKEN);
    release(b, ws, 'final-token', finalGrant.uuid);

    // No wrap, reset, rounding, or token reuse after the exact JSON ceiling.
    const exhausted = acquire(b, ws, 'after-exhaustion');
    assert.equal(exhausted.reply.acquired, false);
    assert.equal(exhausted.reply.error, 'fencing_token_exhausted');
    assert.equal(b.getFencingWatermark(), MAX_FENCING_TOKEN);
  } finally {
    b.stopTtlSweeper();
    if (previous === undefined) delete process.env.LMX_FENCING_TOKEN_FLOOR;
    else process.env.LMX_FENCING_TOKEN_FLOOR = previous;
  }
}

(async () => {
  try {
    await watermarkSurvivesKeyGcAndClockRollback();
    await durableRestartFloorDominatesWallClock();
    await exhaustionFailsClosedWithoutPartialComposite();
    console.log('✅ fencing authority hardening tests passed');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ fencing authority hardening failed:', error?.stack || error);
    process.exit(1);
  }
})();
