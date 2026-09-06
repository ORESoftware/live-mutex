'use strict';


import {routineEnter} from './routine';
import chalk from "chalk";
import {forDebugging} from "./shared-internal";
import {emitTelemetryEvent} from "./telemetry";

const debugLog = process.argv.indexOf('--lmx-debug') > 0;
const clientScopeName = 'live-mutex.client';

const emitClientLog = (severity: 'debug' | 'info' | 'warn' | 'error' | 'fatal', args: any[]) => {
  emitTelemetryEvent({
    scopeName: clientScopeName,
    name: `${clientScopeName}.log.${severity}`,
    severity,
    args,
    attributes: {
      'lmx.component': 'client'
    }
  });
};

export const log = {
  info(...args: any[]) {
    emitClientLog('info', args);
    console.log(chalk.gray.bold('lmx client info:'), ...args);
  },
  warn(...args: any[]) {
    emitClientLog('warn', args);
    console.error(chalk.magenta.bold('lmx client warning:'), ...args);
  },
  error(...args: any[]) {
    emitClientLog('error', args);
    console.error(chalk.red.bold('lmx client error:'), ...args);
  },
  fatal(...args: any[]){
    emitClientLog('fatal', args);
    console.error('lmx client fatal error:', ...arguments);
    process.exit(1);
  },
  debug(...args: any[]) {
    if (debugLog) {
      emitClientLog('debug', args);
      let newTime = Date.now();
      let elapsed = newTime - forDebugging.previousTime;
      forDebugging.previousTime = newTime;
      console.log(chalk.yellow.bold('lmx client debugging:'), 'elapsed millis:', `(${elapsed})`, ...args);
    }
  }
};

export const getClientErrorMessage = (s: string) => {
  const routineId = 'ddl-routine-pwVOsWr4EkLWnzNQ5d';
  routineEnter(routineId, "getClientErrorMessage");
  return `lmx client error: ${s}`
};

export const getClientError = (s: string) => {
  const routineId = 'ddl-routine-Deq1ehXs8AfkwrFfwI';
  routineEnter(routineId, "getClientError");
  return new Error(`lmx client error: ${s}`)
};

export const throwClientError = (s: string) => {
  const routineId = 'ddl-routine-Jv6H7ZJdlYAvC2-ZPH';
  routineEnter(routineId, "throwClientError");
  throw new Error(`lmx client error: ${s}`)
};
