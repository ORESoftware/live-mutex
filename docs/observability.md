# Observability

`live-mutex` emits structured telemetry without monkey-patching Node globals or
installing an OpenTelemetry SDK inside the library. The host application can
subscribe to process events, forward JSON logs to Loki, or bridge the payloads
into an OpenTelemetry pipeline.

## Process Events

The library emits:

- `process.emit('info', event)` for info/debug events.
- `process.emit('warning', error)` for warn/error/fatal events.

Warning `Error` objects carry the structured payload on
`error.lmxTelemetry`.

```js
process.on('info', event => {
  // event is an OpenTelemetry-shaped log payload.
  console.log(JSON.stringify(event));
});

process.on('warning', warning => {
  const event = warning && warning.lmxTelemetry;
  if (event) {
    console.error(JSON.stringify(event));
  }
});
```

Each event includes:

- `schemaUrl`
- `serviceName`
- `serviceVersion`
- `scopeName`
- `name`
- `severityText`
- `severityNumber`
- `timeUnixNano`
- `message`
- `attributes`

The default service name is `live-mutex`. Override it with
`OTEL_SERVICE_NAME` or `LMX_SERVICE_NAME`.

## JSON Logs

Set `LMX_LOG_FORMAT=json` to write newline-delimited structured log payloads
to stdout/stderr. This is the easiest path for Loki or any collector that
tails process logs:

```bash
LMX_LOG_FORMAT=json node your-service.js
```

Disable process-level telemetry events with:

```bash
LMX_PROCESS_TELEMETRY=nope node your-service.js
```

## OpenTelemetry Bridge

The payload shape follows the OpenTelemetry log data model closely enough for a
hosting service to bridge events into its configured OTel SDK/exporter. Keep
the exporter in the application process so deployment-specific choices like
OTLP endpoint, batching, resource attributes, and sampling remain outside the
library.

