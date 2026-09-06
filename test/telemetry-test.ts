#!/usr/bin/env ts-node

'use strict';

import * as assert from 'assert';
import {Client} from '../src/client';
import {createTelemetryEvent, emitTelemetryEvent} from '../src/telemetry';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const onceProcessEvent = (name: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      process.removeListener(name as any, onEvent);
      reject(new Error(`Timed out waiting for process "${name}" event.`));
    }, 1000);

    const onEvent = (value: any) => {
      clearTimeout(timeout);
      resolve(value);
    };

    process.once(name as any, onEvent);
  });
};

const withProcessTelemetryEnabled = async (fn: () => Promise<void>) => {
  const previousProcessTelemetry = process.env.LMX_PROCESS_TELEMETRY;
  const previousLogFormat = process.env.LMX_LOG_FORMAT;

  try {
    delete process.env.LMX_PROCESS_TELEMETRY;
    delete process.env.LMX_LOG_FORMAT;
    await fn();
  }
  finally {
    if (previousProcessTelemetry === undefined) {
      delete process.env.LMX_PROCESS_TELEMETRY;
    }
    else {
      process.env.LMX_PROCESS_TELEMETRY = previousProcessTelemetry;
    }

    if (previousLogFormat === undefined) {
      delete process.env.LMX_LOG_FORMAT;
    }
    else {
      process.env.LMX_LOG_FORMAT = previousLogFormat;
    }
  }
};

const main = async () => {
  await withProcessTelemetryEnabled(async () => {
    const infoEvent = onceProcessEvent('info');
    const emittedInfo = emitTelemetryEvent({
      scopeName: 'live-mutex.test',
      name: 'live-mutex.test.info',
      severity: 'info',
      args: ['hello', {answer: 42}],
      attributes: {
        'test.case': 'process-info'
      }
    });

    const receivedInfo = await infoEvent;
    assert.strictEqual(receivedInfo.name, emittedInfo.name);
    assert.strictEqual(receivedInfo.severityText, 'INFO');
    assert.strictEqual(receivedInfo.attributes['service.name'], 'live-mutex');
    assert.strictEqual(receivedInfo.attributes['test.case'], 'process-info');
    assert.ok(receivedInfo.message.includes('hello'));

    const warningEvent = onceProcessEvent('warning');
    const emittedWarning = emitTelemetryEvent({
      scopeName: 'live-mutex.test',
      name: 'live-mutex.test.warning',
      severity: 'warn',
      args: ['careful'],
      attributes: {
        'test.case': 'process-warning'
      }
    });

    const receivedWarning = await warningEvent;
    assert.ok(receivedWarning instanceof Error);
    assert.strictEqual((receivedWarning as any).code, 'LIVE_MUTEX_TEST_WARNING');
    assert.strictEqual((receivedWarning as any).lmxTelemetry.name, emittedWarning.name);
    assert.strictEqual((receivedWarning as any).lmxTelemetry.severityText, 'WARN');
    assert.strictEqual((receivedWarning as any).lmxTelemetry.attributes['test.case'], 'process-warning');

    const client = new Client();
    client.emitter.on('warning', () => {
      // User warning listener keeps the fallback stderr warning path quiet.
    });

    const emitterWarningEvent = onceProcessEvent('warning');
    client.emitter.emit('warning', 'client warning from emitter');
    const receivedEmitterWarning = await emitterWarningEvent;
    client.close();

    assert.strictEqual((receivedEmitterWarning as any).lmxTelemetry.name, 'live-mutex.client.emitter.warning');
    assert.strictEqual((receivedEmitterWarning as any).lmxTelemetry.attributes['lmx.component'], 'client');
    assert.ok((receivedEmitterWarning as any).lmxTelemetry.message.includes('client warning from emitter'));
  });

  {
    const previousProcessTelemetry = process.env.LMX_PROCESS_TELEMETRY;
    try {
      process.env.LMX_PROCESS_TELEMETRY = 'nope';
      let emitted = false;
      const onInfo = () => {
        emitted = true;
      };

      process.once('info' as any, onInfo);
      emitTelemetryEvent({
        scopeName: 'live-mutex.test',
        name: 'live-mutex.test.disabled-info',
        severity: 'info',
        args: ['should not emit']
      });
      await delay(25);
      process.removeListener('info' as any, onInfo);
      assert.strictEqual(emitted, false, 'LMX_PROCESS_TELEMETRY=nope should suppress process info events');
    }
    finally {
      if (previousProcessTelemetry === undefined) {
        delete process.env.LMX_PROCESS_TELEMETRY;
      }
      else {
        process.env.LMX_PROCESS_TELEMETRY = previousProcessTelemetry;
      }
    }
  }

  {
    const previousServiceName = process.env.OTEL_SERVICE_NAME;
    try {
      process.env.OTEL_SERVICE_NAME = 'lmx-test-service';
      const event = createTelemetryEvent({
        scopeName: 'Live Mutex Test Scope',
        name: 'Live Mutex Test Event!',
        severity: 'debug',
        args: ['debug message'],
        attributes: {
          'test.case': 'create-event'
        }
      });

      assert.strictEqual(event.serviceName, 'lmx-test-service');
      assert.strictEqual(event.name, 'live.mutex.test.event');
      assert.strictEqual(event.severityText, 'DEBUG');
      assert.strictEqual(event.severityNumber, 5);
      assert.strictEqual(event.attributes['service.name'], 'lmx-test-service');
      assert.strictEqual(event.attributes['test.case'], 'create-event');
    }
    finally {
      if (previousServiceName === undefined) {
        delete process.env.OTEL_SERVICE_NAME;
      }
      else {
        process.env.OTEL_SERVICE_NAME = previousServiceName;
      }
    }
  }

  console.log('telemetry-test passed');
};

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
