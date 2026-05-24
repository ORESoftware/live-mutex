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
 * `routineEnter` does three things synchronously:
 *
 *   - Writes a single line to stdout in the existing `chalk` style so plain
 *     log readers (`kubectl logs`, `grep`) see the entry.
 *   - Starts a one-shot OTel span named `routine` with attributes
 *     `routine_id=<id>` and `code.function=<fnName>`, then immediately ends
 *     it. The span's brief lifetime keeps the parent OTel context untouched
 *     (so nested fns still attribute to whichever ambient span is active),
 *     while still surfacing the routine entry as a real, exportable span
 *     for OTel-aware viewers.
 *   - When OTel isn't initialised (e.g. tests, no `OTEL_EXPORTER_OTLP_ENDPOINT`
 *     env var), the span call is a no-op via `@opentelemetry/api`'s default
 *     no-op tracer.
 *
 * ## OTel exporter
 *
 * `initOtel()` is called from the broker entrypoint
 * (`lm-start-server.ts`). It checks `OTEL_EXPORTER_OTLP_ENDPOINT`; when set,
 * it installs a Node SDK Tracer Provider with an OTLP/gRPC exporter. When
 * unset, it installs nothing — the default no-op tracer takes over and
 * `routineEnter` becomes a stdout-only operation.
 *
 * Idempotent: subsequent calls to `initOtel()` after the first are
 * silently ignored.
 */

import {
  trace,
  Tracer,
  Span,
  SpanStatusCode,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from '@opentelemetry/api';

const SERVICE_NAME_DEFAULT = 'live-mutex';

let otelInitialised = false;
let cachedTracer: Tracer | null = null;

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
  process.stdout.write(
    `lmx routine: routineId=${routineId} fn=${codeFunction} event=enter\n`,
  );

  // 2. OTel span. `startSpan` returns a no-op span when OTel isn't
  //    initialised, so this is safe to call unconditionally. We end the
  //    span synchronously to keep its lifetime confined to fn entry — it
  //    documents the entry event, it does not enclose the rest of the body.
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
 * Initialise the OpenTelemetry trace pipeline. Safe to call multiple times.
 *
 * Reads:
 *   - `OTEL_EXPORTER_OTLP_ENDPOINT` (required to enable OTel; unset = no-op)
 *   - `OTEL_SERVICE_NAME` (default: `live-mutex`)
 *   - `OTEL_RESOURCE_ATTRIBUTES` (honored by the SDK Resource detector)
 *
 * The SDK is loaded lazily so a caller that never sets the OTLP endpoint
 * env var doesn't pay the SDK startup cost.
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
    NodeTracerProvider,
  } = require('@opentelemetry/sdk-trace-node');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
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
  const provider = new NodeTracerProvider({ resource });
  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();

  otelInitialised = true;

  process.stdout.write(
    `lmx otel: OTLP exporter installed -> ${endpoint} (service=${serviceName})\n`,
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
  // The provider is registered globally via `provider.register()`; recover
  // it from the global API surface and call `shutdown()` if available.
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

/**
 * Wrap a sync or async function body in an OTel span that *encloses* the
 * full body (unlike `routineEnter`, which is a brief one-shot span).
 *
 * Useful for the broker's request handlers, where you want all child
 * operations (queue pushes, response writes) to attribute to the same
 * parent span.
 *
 * ```ts
 * export async function handleAcquire(req: AcquireRequest) {
 *   const routineId = 'ddl-routine-handleAcquire-…';
 *   return withRoutineSpan(routineId, 'handleAcquire', async () => {
 *     // body
 *   });
 * }
 * ```
 */
export function withRoutineSpan<T>(
  routineId: string,
  codeFunction: string,
  fn: (span: Span) => T,
): T {
  const fnRoutineId = 'ddl-routine-withRoutineSpan-Op4';
  routineEnter(routineId, codeFunction);
  return getTracer().startActiveSpan(
    `routine:${codeFunction}`,
    {
      attributes: {
        'routine_id': routineId,
        'code.function': codeFunction,
      },
    },
    (span) => {
      try {
        const result = fn(span);
        if (result instanceof Promise) {
          return result
            .then((v) => {
              span.setStatus({ code: SpanStatusCode.OK });
              return v;
            })
            .catch((err) => {
              span.recordException(err as Error);
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: (err as Error)?.message,
              });
              throw err;
            })
            .finally(() => span.end()) as unknown as T;
        }
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (err as Error)?.message,
        });
        span.end();
        throw err;
      }
    },
  );
}
