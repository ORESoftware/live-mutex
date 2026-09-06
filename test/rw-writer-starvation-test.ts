#!/usr/bin/env node

'use strict';

import * as assert from 'assert';
import {Broker1, RWLockWritePrefClient} from '../dist/main';
import {log as brokerLog} from '../dist/broker-1';

type ReleaseFn = (cb?: (err?: any, val?: any) => void) => void;

const parsedPort = Number.parseInt(process.env.LMX_TEST_PORT || '', 10);
const port = Number.isInteger(parsedPort) ? parsedPort : 11700 + Math.floor(Math.random() * 1000);
const key = 'rw-writer-starvation-key';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toError(value: any): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  return new Error(JSON.stringify(value));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timer = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${message} (timeout after ${timeoutMs}ms)`)), timeoutMs);
  });
  return Promise.race([promise, timer]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

function ensureClient(client: RWLockWritePrefClient): Promise<RWLockWritePrefClient> {
  return new Promise((resolve, reject) => {
    client.ensure()
      .then(() => resolve(client))
      .catch(reject);
  });
}

function acquireRead(client: RWLockWritePrefClient): Promise<ReleaseFn> {
  return new Promise((resolve, reject) => {
    client.acquireReadLock(key, {lockRequestTimeout: 15000}, (err: any, release: ReleaseFn) => {
      if (err) {
        reject(toError(err));
        return;
      }
      resolve(release);
    });
  });
}

function acquireWrite(client: RWLockWritePrefClient): Promise<ReleaseFn> {
  return new Promise((resolve, reject) => {
    client.acquireWriteLock(key, {lockRequestTimeout: 15000}, (err: any, release: ReleaseFn) => {
      if (err) {
        reject(toError(err));
        return;
      }
      resolve(release);
    });
  });
}

function releaseLock(release: ReleaseFn, label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    release((err?: any) => {
      if (err) {
        reject(toError(err));
        return;
      }
      resolve();
    });
  }).then(
    (): void => undefined,
    (err: any): never => {
      throw new Error(`${label}: ${err.message || err}`);
    }
  );
}

function closeClient(client: {close: () => void}): void {
  try {
    client.close();
  }
  catch (_) {
    // best-effort cleanup
  }
}

async function closeBroker(broker: Broker1): Promise<void> {
  await Promise.race([
    new Promise<void>(resolve => broker.close(() => resolve())),
    delay(2000),
  ]);
}

async function main(): Promise<void> {
  console.log('=== RW writer starvation test (Broker1) ===');
  console.log(`Using port: ${port}`);

  const originalBrokerWarn = brokerLog.warn;
  brokerLog.warn = (...args: any[]) => {
    const text = args.map(v => typeof v === 'string' ? v : String(v)).join(' ');
    if (text.includes('Semaphore limit exceeded') && text.includes(key)) {
      return;
    }
    originalBrokerWarn(...args);
  };

  const broker = new Broker1({port});
  broker.emitter.on('warning', () => {});
  broker.emitter.on('error', err => {
    console.error('[BROKER ERROR]', err);
  });
  await withTimeout(broker.ensure(), 5000, 'broker ensure failed');

  const clients: RWLockWritePrefClient[] = [];
  let stopReaders = false;

  try {
    const readerCount = 16;
    const readers: RWLockWritePrefClient[] = [];
    for (let i = 0; i < readerCount; i++) {
      const client = await withTimeout(
        ensureClient(new RWLockWritePrefClient({port, lockRequestTimeout: 15000})),
        5000,
        `reader client ${i} ensure failed`
      );
      client.emitter.on('warning', () => {});
      client.emitter.on('error', err => {
        if (!stopReaders) {
          console.error(`[READER ${i} ERROR]`, err);
        }
      });
      readers.push(client);
      clients.push(client);
    }

    const writer = await withTimeout(
      ensureClient(new RWLockWritePrefClient({port, lockRequestTimeout: 15000})),
      5000,
      'writer client ensure failed'
    );
    writer.emitter.on('warning', () => {});
    writer.emitter.on('error', err => {
      console.error('[WRITER ERROR]', err);
    });
    clients.push(writer);

    let readAcquisitions = 0;
    const readerErrors: Error[] = [];

    const readerTasks = readers.map(async (reader, index) => {
      while (!stopReaders) {
        try {
          const release = await withTimeout(acquireRead(reader), 15000, `reader ${index} acquire failed`);
          readAcquisitions++;
          await delay(2);
          await withTimeout(releaseLock(release, `reader ${index} release failed`), 5000, `reader ${index} release timeout`);
          if (stopReaders) {
            break;
          }
          await delay(1);
        }
        catch (err) {
          if (!stopReaders) {
            readerErrors.push(toError(err));
            stopReaders = true;
          }
          break;
        }
      }
    });

    await delay(250);
    const baselineReads = readAcquisitions;
    assert.ok(
      baselineReads > 50,
      `reader workload too light: only ${baselineReads} reads in 250ms`
    );

    const started = Date.now();
    const releaseWrite = await withTimeout(
      acquireWrite(writer),
      5000,
      'writer was starved by steady reader load'
    );
    const writerWaitMs = Date.now() - started;

    stopReaders = true;
    await withTimeout(releaseLock(releaseWrite, 'writer release failed'), 5000, 'writer release timeout');
    await withTimeout(Promise.all(readerTasks), 10000, 'reader tasks did not stop after writer release');

    assert.strictEqual(readerErrors.length, 0, `reader loop failed: ${readerErrors[0]?.message}`);
    assert.ok(
      writerWaitMs < 5000,
      `writer starved for ${writerWaitMs}ms under reader load`
    );

    console.log(`Writer acquired after ${writerWaitMs}ms with ${readAcquisitions} reader acquisitions.`);
    console.log('All tests passed');
  }
  finally {
    stopReaders = true;
    clients.forEach(closeClient);
    await closeBroker(broker);
    brokerLog.warn = originalBrokerWarn;
  }
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
