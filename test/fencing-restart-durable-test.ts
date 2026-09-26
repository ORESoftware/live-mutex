'use strict';

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {Broker1, setLogLevel} from '../dist/main';
import {v4 as uuidV4} from 'uuid';

setLogLevel('error');

interface FakeSocket {
  writable: boolean;
  sent: any[];
  cursor: number;
  write(chunk: any): boolean;
  end(): void;
  destroy(): void;
  on(): void;
}

function makeSocket(): FakeSocket {
  const sent: any[] = [];
  return {
    writable: true,
    sent,
    cursor: 0,
    write(chunk: any): boolean {
      const lines = chunk.toString().trim().split('\n').filter(Boolean);
      for (const line of lines) {
        sent.push(JSON.parse(line));
      }
      return true;
    },
    end() {
      // noop
    },
    destroy() {
      // noop
    },
    on() {
      // noop
    },
  };
}

function nextGrant(broker: Broker1, socket: FakeSocket, key: string): any {
  const requestUuid = uuidV4();
  broker.lock({
    uuid: requestUuid,
    key,
    ttl: 120_000,
    wait: false,
  } as any, socket as any);

  const frames = socket.sent.slice(socket.cursor);
  socket.cursor = socket.sent.length;
  const grant = frames.find(frame => frame.type === 'lock' && frame.acquired === true);
  assert.ok(grant, `expected an acquired lock frame for ${key}`);
  assert.ok(Number.isSafeInteger(grant.fencingToken) && grant.fencingToken > 0);

  return {grant, requestUuid};
}

function readPersistedWatermark(statePath: string): number {
  const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.strictEqual(parsed.schema, 'live-mutex.fencing-watermark/v1');
  assert.match(parsed.watermark, /^(0|[1-9][0-9]*)$/);
  const value = Number(parsed.watermark);
  assert.ok(Number.isSafeInteger(value));
  return value;
}

async function main() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-mutex-fencing-'));
  const statePath = path.join(tempDirectory, 'authority', 'watermark.json');
  const previousStatePath = process.env.LMX_FENCING_TOKEN_STATE_PATH;
  const previousFloor = process.env.LMX_FENCING_TOKEN_FLOOR;
  const originalNow = Date.now;

  process.env.LMX_FENCING_TOKEN_STATE_PATH = statePath;
  delete process.env.LMX_FENCING_TOKEN_FLOOR;

  try {
    const firstBroker = new Broker1({noListen: true} as any);
    (firstBroker as any).emitter.on('warning', () => {
      // Keep the test output focused on assertions.
    });
    await firstBroker.ensure();

    const firstSocket = makeSocket();
    const key = 'durable-restart/orders/42';
    const first = nextGrant(firstBroker, firstSocket, key);
    const persistedAfterFirstGrant = readPersistedWatermark(statePath);
    assert.ok(
      persistedAfterFirstGrant >= first.grant.fencingToken,
      'durable watermark must reach the granted token before the grant is observable',
    );

    firstBroker.unlock({
      uuid: uuidV4(),
      key,
      _uuid: first.requestUuid,
    } as any, firstSocket as any);
    (firstBroker as any).stopTtlSweeper();

    Date.now = () => 1;

    const secondBroker = new Broker1({noListen: true} as any);
    (secondBroker as any).emitter.on('warning', () => {
      // Keep the test output focused on assertions.
    });
    await secondBroker.ensure();

    assert.strictEqual(secondBroker.isDurableFencingMode(), true);
    assert.ok(
      secondBroker.getFencingWatermark() >= persistedAfterFirstGrant,
      'restart must restore the persisted watermark even after wall-clock rollback',
    );

    const secondSocket = makeSocket();
    const second = nextGrant(secondBroker, secondSocket, key);
    assert.ok(
      second.grant.fencingToken > first.grant.fencingToken,
      'successor after restart must receive a strictly greater fencing token',
    );

    const downstreamWatermark = second.grant.fencingToken;
    assert.ok(
      first.grant.fencingToken < downstreamWatermark,
      'a delayed pre-restart owner must be rejected by the downstream high-watermark',
    );

    const persistedAfterSecondGrant = readPersistedWatermark(statePath);
    assert.ok(persistedAfterSecondGrant >= second.grant.fencingToken);
    (secondBroker as any).stopTtlSweeper();

    fs.writeFileSync(statePath, '{not-json', 'utf8');
    assert.throws(
      () => new Broker1({noListen: true} as any),
      /could not read durable fencing state/,
      'corrupt durable authority must fail closed instead of silently resetting',
    );

    console.log('✅ live-mutex durable restart fencing contract passed');
  }
  finally {
    Date.now = originalNow;

    if (previousStatePath === undefined) {
      delete process.env.LMX_FENCING_TOKEN_STATE_PATH;
    }
    else {
      process.env.LMX_FENCING_TOKEN_STATE_PATH = previousStatePath;
    }

    if (previousFloor === undefined) {
      delete process.env.LMX_FENCING_TOKEN_FLOOR;
    }
    else {
      process.env.LMX_FENCING_TOKEN_FLOOR = previousFloor;
    }

    fs.rmSync(tempDirectory, {recursive: true, force: true});
  }
}

main().catch((error) => {
  console.error('❌ live-mutex durable restart fencing contract failed:', error && error.stack || error);
  process.exit(1);
});
