#!/usr/bin/env node
'use strict';

import {Client, log, validConstructorOptions, validLockOptions} from "./client";
import chalk from "chalk";
const index = process.argv.indexOf('--json');
let v = null as any;

if (index > 1) {
  try {
    v = JSON.parse(process.argv[index + 1]);
  }
  catch (err) {
    log.error(`Could not parse your --json argument, try --json '{"port": 3091,"key": "foo"}' ... ` +
      chalk.magenta(`run your JSON through a validator if need be.`));
    throw chalk.magentaBright(err.message);
  }
}
else {
  v = {} as any;
}

process.once('warning' as any, function (e: any) {
  log.error('process warning:', e && e.message || e);
});

process.once('error' as any, function (e: any) {
  log.error('process error:', e && e.message || e);
  process.exit(1);
});

process.once('unhandledRejection', function (e: any) {
  log.error('unhandledRejection:', e && e.message || e);
  process.exit(1);
});

process.once('uncaughtException', function (e: any) {
  log.error('uncaughtException:', e && e.message || e);
  process.exit(1);
});

const getSelectable = function (selectable, original) {
  return Object.keys(selectable).reduce((a, b) => (a[b] = original[b], a), {})
};

const clientOpts = getSelectable(validConstructorOptions, v);

new Client(clientOpts).ensure().then(function (c) {
  
  c.ls(function (err, results) {
    
    if (err) throw err;
    console.log(chalk.blueBright('Number of locks:'), chalk.bold(results.ls_result.length));
    console.log(chalk.blueBright('Lock keys list:'), results.ls_result);
    process.exit(0);
    
  });
});