'use strict';

/**
 * # `routineId` and OpenTelemetry plumbing
 *
 * Every top-level function/method in `live-mutex` carries a *static* string
 * that looks like `ddl-routine-<nanoid>`. The ID is **never generated at
 * runtime** — it is a literal embedded in the source file. Two properties
 * make this pattern useful:
 *
 *   1. **Grep-ability.** Given a log line that contains a routine ID,
 *      `rg ddl-routine-<id>` lands on the source location in one search,
 *      no fuzzy log-text matching required.
 *   2. **OTel attribute key.** The same ID is attached as a span attribute
 *      (`routine_id`) on a brief OTel span emitted at function entry, so
 *      it flows through OTLP into observability backends with no extra
 *      work at the call site.
 *
 * ## Zero-monkey-patching policy (Node.js)
 *
 * This module deliberately avoids every OTel feature that would install
 * a global hook into Node's runtime. Specifically:
 *
 *   - We use `BasicTracerProvider` from `@opentelemetry/sdk-trace-base`,
 *     **not** `NodeTracerProvider` from `@opentelemetry/sdk-trace-node`.
 *     `NodeTracerProvider.register()` would install an
 *     `AsyncHooksContextManager` (or `AsyncLocalStorageContextManager`),
 *     register W3C trace-context + baggage propagators globally, and on
 *     newer SDKs subscribe to Node `async_hooks`. We don't need any of
 *     that for our use-case (one-shot spans at function entry — no
 *     parent/child propagation across `await` boundaries).
 *   - We wire the provider via `trace.setGlobalTracerProvider(provider)`
 *     directly, never via `provider.register(...)`. This keeps the
 *     install footprint to just "the global tracer factory now points at
 *     our provider"; nothing else in Node's runtime is touched.
 *   - We do not import or register any auto-instrumentation
 *     (`@opentelemetry/instrumentation`, `auto-instrumentations-node`,
 *     etc.). Nothing in this process gets monkey-patched. HTTP, fs,
 *     dns, child_process, gRPC client modules — all stay original.
 *
 * If a future change ever needs cross-`await` parent-span propagation,
 * the right move is to make that *opt-in* (a separate explicit
 * initialiser the caller has to invoke) — never default-on.
 *
 * ## Usage
 *
 * Every top-level function should start with a single line:
 *
 * ```ts
 * import { routineEnter } from './routine';
 *
 * export function handleAcquire(req: AcquireRequest) {
 *   const routineId = 'ddl-routine-XXXXXXXXXXXXXX';
 *   routineEnter(routineId, 'handleAcquire');
 *   // ... body, can reference `routineId` in subsequent log calls ...
 * }
 * ```
 *
 * `routineEnter` does two things synchronously:
 *
 *   - Writes a single line to stdout in plain text so log readers
 *     (`kubectl logs`, `grep`) see the entry without any colour codes.
 *   - Starts a one-shot OTel span named `routine` with attributes
 *     `routine_id=<id>` and `code.function=<fnName>`, then immediately
 *     ends it. Because we never enter the span as the active context,
 *     there is no async-context tracking, no AsyncLocalStorage, no
 *     async_hooks involvement. The span is recorded as a leaf event.
 *   - When OTel isn't initialised (e.g. tests, no
 *     `OTEL_EXPORTER_OTLP_ENDPOINT` env var), the span call is a no-op
 *     via `@opentelemetry/api`'s default no-op tracer.
 *
 * ## OTel exporter
 *
 * `initOtel()` is called from the broker entrypoint
 * (`lm-start-server.ts`). It checks `OTEL_EXPORTER_OTLP_ENDPOINT`; when
 * set, it installs a basic tracer provider + OTLP/gRPC exporter and
 * points the global `trace` API at it. When unset, it installs nothing
 * — the default no-op tracer takes over and `routineEnter` becomes a
 * stdout-only operation.
 *
 * Idempotent: subsequent calls to `initOtel()` after the first are
 * silently ignored.
 */

import {
  trace,
  Tracer,
  SpanStatusCode,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from '@opentelemetry/api';
import { isLogLevelEnabled } from './log-level';

const SERVICE_NAME_DEFAULT = 'live-mutex';

let otelInitialised = false;
let cachedTracer: Tracer | null = null;
/// Runtime kill-switch for OTel span emission. Toggled by
/// `setOtelEnabled` (called from the broker's HTTP admin endpoint
/// `POST /admin/otel`). When `false`, `routineEnter` skips the OTel
/// `startSpan`/`end` pair entirely — stdout logging continues
/// regardless. Default `false` until `initOtel()` confirms an OTLP
/// exporter has been wired up; flipping the flag without a configured
/// exporter is harmless (spans go to the no-op tracer either way).
let otelEnabled = false;

/** Internal: lazy tracer accessor. Falls back to the no-op tracer if OTel isn't configured. */
function getTracer(): Tracer {
  const fnRoutineId = 'ddl-routine-getTracer-Bn7';
  if (cachedTracer) return cachedTracer;
  cachedTracer = trace.getTracer(SERVICE_NAME_DEFAULT);
  return cachedTracer;
}

/**
 * Mark the entry of a top-level function/method.
 *
 * @param routineId - Static literal of the form `ddl-routine-<nanoid>`. Must
 *                    be a value that exists in the source file as-is, so
 *                    `rg <routineId>` finds the call site.
 * @param codeFunction - Human-readable function name (typically
 *                       `ClassName.methodName` or just `functionName`).
 *                       Used as the `code.function` attribute on the
 *                       emitted OTel span and as a prefix on the stdout
 *                       log line.
 */
export function routineEnter(routineId: string, codeFunction: string): void {
  const fnRoutineId = 'ddl-routine-routineEnter-Mq2';
  // 1. Stdout log line. Goes through `process.stdout.write` (not console.log)
  //    so it has zero `console.*` overhead in tests that pipe stdout to a
  //    file. No chalk colours: this can run in test/non-tty contexts where
  //    ANSI escape codes would corrupt downstream parsers.
  //
  //    Gated on the runtime log level (see `src/log-level.ts` and the
  //    `POST /admin/log-level` endpoint). The line is classified as
  //    `info` so the default level still emits it; setting the level
  //    to `silent`, `error`, or `warn` at runtime quiets it without a
  //    restart.
  if (isLogLevelEnabled('info')) {
    process.stdout.write(
      `lmx routine: routineId=${routineId} fn=${codeFunction} event=enter\n`,
    );
  }

  // 2. OTel span — gated on the runtime kill-switch `otelEnabled`. When
  //    off, we skip the startSpan/end pair entirely so there is zero
  //    OTel touch per call (no allocation, no batch-processor enqueue,
  //    no spec-time collection). Operators flip this flag at runtime via
  //    the `POST /admin/otel` HTTP endpoint without restarting the
  //    process. We use `startSpan` (NOT `startActiveSpan`) so even when
  //    enabled the span is a leaf — no AsyncLocalStorage write, no
  //    async_hooks subscription, no monkey-patching.
  if (!otelEnabled) {
    return;
  }
  const span = getTracer().startSpan('routine', {
    attributes: {
      'routine_id': routineId,
      'code.function': codeFunction,
    },
  });
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

/**
 * Runtime kill-switch for OTel span emission. Returns the previous
 * value so callers (e.g. the HTTP admin endpoint) can include it in
 * an audit log.
 *
 * Safe to call any time — before or after `initOtel()`, with or
 * without a configured OTLP exporter. When called with `enabled=true`
 * but no exporter is wired up, spans are emitted to the API package's
 * no-op tracer and quietly discarded.
 */
export function setOtelEnabled(enabled: boolean): boolean {
  const fnRoutineId = 'ddl-routine-setOtelEnabled-Tg5';
  const previous = otelEnabled;
  otelEnabled = !!enabled;
  if (isLogLevelEnabled('info')) {
    process.stdout.write(
      `lmx otel: ${fnRoutineId} fn=setOtelEnabled previous=${previous} next=${otelEnabled}\n`,
    );
  }
  return previous;
}

/** Read-only accessor for the current runtime kill-switch state. */
export function isOtelEnabled(): boolean {
  const fnRoutineId = 'ddl-routine-isOtelEnabled-Bf8';
  return otelEnabled;
}

/**
 * Initialise the OpenTelemetry trace pipeline. Safe to call multiple times.
 *
 * Reads:
 *   - `OTEL_EXPORTER_OTLP_ENDPOINT` (required to enable OTel; unset = no-op)
 *   - `OTEL_SERVICE_NAME` (default: `live-mutex`)
 *   - `OTEL_RESOURCE_ATTRIBUTES` (honored by the SDK Resource detector)
 *
 * The SDK is loaded lazily so a caller that never sets the OTLP endpoint
 * env var doesn't pay the SDK startup cost.
 *
 * Wiring strategy is the minimal one possible: construct a
 * `BasicTracerProvider`, attach a `BatchSpanProcessor`+OTLP/gRPC exporter,
 * and point the global tracer factory at it via
 * `trace.setGlobalTracerProvider`. We deliberately do **not** call
 * `provider.register(...)` because that's the call that would install an
 * async-context manager and trace-context propagators — i.e. the call
 * that would let OTel observe Node internals. See the file header for
 * the full no-monkey-patching rationale.
 */
export function initOtel(): void {
  const routineId = 'ddl-routine-initOtel-Vq8wzKp';
  routineEnter(routineId, 'initOtel');
  if (otelInitialised) return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint || !endpoint.trim()) {
    process.stdout.write(
      'lmx otel: OTEL_EXPORTER_OTLP_ENDPOINT not set; staying on stdout-only tracing.\n',
    );
    otelInitialised = true;
    return;
  }

  // Optional: surface SDK-internal warnings. Useful in cluster debugging
  // when the exporter silently drops batches.
  if (process.env.OTEL_LOG_LEVEL === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  // Lazy-require so the OTel SDK is only loaded when an exporter endpoint
  // is configured. Keeps `require('live-mutex')` cheap in test setups
  // that never wire up OTel.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Resource } = require('@opentelemetry/resources');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    BasicTracerProvider,
    BatchSpanProcessor,
  } = require('@opentelemetry/sdk-trace-base');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    OTLPTraceExporter,
  } = require('@opentelemetry/exporter-trace-otlp-grpc');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const semconv = require('@opentelemetry/semantic-conventions');

  const serviceName =
    process.env.OTEL_SERVICE_NAME || SERVICE_NAME_DEFAULT;
  const resource = new Resource({
    [semconv.SEMRESATTRS_SERVICE_NAME ||
      semconv.ATTR_SERVICE_NAME ||
      'service.name']: serviceName,
    [semconv.SEMRESATTRS_SERVICE_VERSION ||
      semconv.ATTR_SERVICE_VERSION ||
      'service.version']:
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../package.json').version,
  });

  const exporter = new OTLPTraceExporter({ url: endpoint });
  const provider = new BasicTracerProvider({ resource });
  provider.addSpanProcessor(new BatchSpanProcessor(exporter));

  // Point the global API at our provider WITHOUT calling
  // `provider.register(...)`. `register()` is the entry point that
  // would install a Node-specific context manager (async_hooks /
  // AsyncLocalStorage) and the W3C trace-context propagator globally —
  // exactly the kind of monkey-patching this module exists to avoid.
  // `setGlobalTracerProvider` only updates the tracer factory pointer.
  trace.setGlobalTracerProvider(provider);

  otelInitialised = true;
  // Default the runtime kill-switch to ON now that an exporter is
  // wired up. Operators can disable via `POST /admin/otel` without
  // restarting; the flag is the only thing controlling whether spans
  // actually get created in `routineEnter`.
  otelEnabled = true;

  process.stdout.write(
    `lmx otel: OTLP exporter installed -> ${endpoint} (service=${serviceName}, no-monkey-patch mode, runtime kill-switch=on)\n`,
  );
}

/**
 * Gracefully flush + shut down the OTel pipeline. Call from the binary's
 * SIGINT/SIGTERM handler before tearing down sockets, so in-flight spans
 * reach the collector.
 */
export async function shutdownOtel(): Promise<void> {
  const routineId = 'ddl-routine-shutdownOtel-Hl3';
  routineEnter(routineId, 'shutdownOtel');
  if (!otelInitialised) return;
  // Recover the registered provider and call `shutdown()` if available.
  const provider: any = (trace as any).getTracerProvider();
  if (provider && typeof provider.shutdown === 'function') {
    try {
      await provider.shutdown();
    } catch (err) {
      process.stderr.write(
        `lmx otel: error shutting down tracer provider: ${
          (err as Error)?.message || err
        }\n`,
      );
    }
  }
}
