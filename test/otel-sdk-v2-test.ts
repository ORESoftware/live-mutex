'use strict';

/**
 * Runtime regression coverage for the OpenTelemetry SDK 2.x wiring.
 *
 * This test replaces the network export method with an in-memory collector,
 * then exercises the real live-mutex initialiser and shutdown path. That keeps
 * the test hermetic while still proving that resource construction, provider
 * registration, span processing, environment attributes, and graceful flush
 * all work with the installed SDK.
 */

import * as assert from 'assert';
import {context} from '@opentelemetry/api';

const watchdog = setTimeout(() => {
  console.error('FAIL: otel-sdk-v2-test timed out');
  process.exit(1);
}, 10_000);
watchdog.unref();

const exportedSpans: any[] = [];
const exporterModule: any = require(
  '@opentelemetry/exporter-trace-otlp-grpc',
);

exporterModule.OTLPTraceExporter.prototype.export = function (
  spans: any[],
  callback: (result: {code: number}) => void,
): void {
  exportedSpans.push(...spans);
  callback({code: 0});
};

exporterModule.OTLPTraceExporter.prototype.shutdown =
  function (): Promise<void> {
    return Promise.resolve();
  };

process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://127.0.0.1:4317';
process.env.OTEL_SERVICE_NAME = 'live-mutex-otel-v2-test';
process.env.OTEL_RESOURCE_ATTRIBUTES =
  'deployment.environment.name=test%20environment,custom.key=custom%20value';
process.env.LMX_LOG_LEVEL = 'silent';

const contextBeforeInitialisation = context.active();
const {
  initOtel,
  isOtelEnabled,
  routineEnter,
  shutdownOtel,
} = require('../dist/routine');

async function main(): Promise<void> {
  try {
    initOtel();
    assert.strictEqual(isOtelEnabled(), true);
    assert.strictEqual(
      context.active(),
      contextBeforeInitialisation,
      'initialisation must not install an async context manager',
    );

    routineEnter(
      'ddl-routine-otel-sdk-v2-test-span',
      'otelSdkV2RuntimeTest',
    );
    await shutdownOtel();

    assert.strictEqual(isOtelEnabled(), false);
    assert.ok(exportedSpans.length >= 2, 'expected buffered spans to flush');

    const attributes = exportedSpans[0].resource.attributes;
    assert.strictEqual(
      attributes['service.name'],
      'live-mutex-otel-v2-test',
    );
    assert.strictEqual(
      attributes['service.version'],
      require('../package.json').version,
    );
    assert.strictEqual(
      attributes['deployment.environment.name'],
      'test environment',
    );
    assert.strictEqual(attributes['custom.key'], 'custom value');
    assert.strictEqual(attributes['telemetry.sdk.name'], 'opentelemetry');

    console.log('✅ otel-sdk-v2-test: all checks passed');
  } finally {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_SERVICE_NAME;
    delete process.env.OTEL_RESOURCE_ATTRIBUTES;
    delete process.env.LMX_LOG_LEVEL;
    clearTimeout(watchdog);
  }
}

main().catch(err => {
  console.error('FAIL:', (err && err.stack) || err);
  process.exit(1);
});
