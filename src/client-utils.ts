'use strict';

import chalk from "chalk";
import {forDebugging} from "./shared-internal";

const debugLog = process.argv.indexOf('--lmx-debug') > 0;

export const log = {
  info: console.log.bind(console, chalk.gray.bold('lmx client info:')),
  warn: console.error.bind(console, chalk.magenta.bold('lmx client warning:')),
  error: console.error.bind(console, chalk.red.bold('lmx client error:')),
  fatal(...args: any[]){
    console.error('lmx client fatal error:', ...arguments);
    process.exit(1);
  },
  debug(...args: any[]) {
    if (debugLog) {
      let newTime = Date.now();
      let elapsed = newTime - forDebugging.previousTime;
      forDebugging.previousTime = newTime;
      console.log(chalk.yellow.bold('lmx client debugging:'), 'elapsed millis:', `(${elapsed})`, ...args);
    }
  }
};

export const getClientErrorMessage = (s: string) => {
  return `lmx client error: ${s}`
};

export const getClientError = (s: string) => {
  return new Error(`lmx client error: ${s}`)
};

export const throwClientError = (s: string) => {
  throw new Error(`lmx client error: ${s}`)
};