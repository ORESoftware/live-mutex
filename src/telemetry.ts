'use strict';

import * as util from 'util';
import {packageJsonData} from './package-json-loader';

export type LMXTelemetrySeverity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LMXTelemetryEvent {
  schemaUrl: string;
  serviceName: string;
  serviceVersion: string;
  scopeName: string;
  name: string;
  severityText: string;
  severityNumber: number;
  timeUnixNano: string;
  message: string;
  attributes: {
    [key: string]: string | number | boolean | null | undefined
  };
}

export interface LMXTelemetryInput {
  scopeName: string;
  name: string;
  severity: LMXTelemetrySeverity;
  args?: any[];
  message?: string;
  attributes?: {
    [key: string]: string | number | boolean | null | undefined
  };
}

const severityNumbers: {[key in LMXTelemetrySeverity]: number} = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
  fatal: 21
};

const warningSeverities = new Set<LMXTelemetrySeverity>(['warn', 'error', 'fatal']);

const normalizeName = (name: string): string => {
  return String(name || 'lmx.event')
    .replace(/[^a-zA-Z0-9_.-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase() || 'lmx.event';
};

const stringifyValue = (value: any): string => {
  if (value instanceof Error) {
    return value.stack || value.message || String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  return util.inspect(value, {depth: 4, breakLength: Infinity});
};

const makeMessage = (input: LMXTelemetryInput): string => {
  if (input.message) {
    return input.message;
  }

  const args = input.args || [];
  return args.map(stringifyValue).join(' ');
};

const nowUnixNano = (): string => {
  return String(Date.now() * 1000000);
};

const shouldWriteJsonLogs = (): boolean => {
  return String(process.env.LMX_LOG_FORMAT || '').toLowerCase() === 'json';
};

const shouldEmitProcessEvents = (): boolean => {
  return String(process.env.LMX_PROCESS_TELEMETRY || '').toLowerCase() !== 'nope';
};

export const createTelemetryEvent = (input: LMXTelemetryInput): LMXTelemetryEvent => {
  const severity = input.severity || 'info';
  const serviceName = process.env.OTEL_SERVICE_NAME || process.env.LMX_SERVICE_NAME || 'live-mutex';

  return {
    schemaUrl: 'https://opentelemetry.io/schemas/1.27.0',
    serviceName,
    serviceVersion: packageJsonData.version || '0.0.0',
    scopeName: input.scopeName,
    name: normalizeName(input.name),
    severityText: severity.toUpperCase(),
    severityNumber: severityNumbers[severity],
    timeUnixNano: nowUnixNano(),
    message: makeMessage(input),
    attributes: {
      'service.name': serviceName,
      'service.version': packageJsonData.version || '0.0.0',
      'telemetry.sdk.language': 'nodejs',
      'lmx.scope': input.scopeName,
      ...(input.attributes || {})
    }
  };
};

export const emitTelemetryEvent = (input: LMXTelemetryInput): LMXTelemetryEvent => {
  const event = createTelemetryEvent(input);
  const severity = input.severity || 'info';

  if (shouldEmitProcessEvents()) {
    if (warningSeverities.has(severity)) {
      const warning = new Error(event.message);
      warning.name = 'LMXTelemetryWarning';
      (warning as any).code = event.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      (warning as any).lmxTelemetry = event;
      process.emit('warning' as any, warning);
    }
    else {
      process.emit('info' as any, event);
    }
  }

  if (shouldWriteJsonLogs()) {
    const line = JSON.stringify(event) + '\n';
    const stream = warningSeverities.has(severity) ? process.stderr : process.stdout;
    stream.write(line);
  }

  return event;
};

export const emitEmitterWarningTelemetry = (
  scopeName: string,
  args: any[],
  attributes?: LMXTelemetryInput['attributes']
): LMXTelemetryEvent => {
  return emitTelemetryEvent({
    scopeName,
    name: `${scopeName}.emitter.warning`,
    severity: 'warn',
    args,
    attributes
  });
};

export const emitEmitterInfoTelemetry = (
  scopeName: string,
  args: any[],
  attributes?: LMXTelemetryInput['attributes']
): LMXTelemetryEvent => {
  return emitTelemetryEvent({
    scopeName,
    name: `${scopeName}.emitter.info`,
    severity: 'info',
    args,
    attributes
  });
};

