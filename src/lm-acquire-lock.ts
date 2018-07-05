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
  v.key = process.argv[2] || process.env.live_mutex_key || '';
  v.port = parseInt(process.argv[3] || process.env.live_mutex_port || '6970');
}

if (!Number.isInteger(v.port)) {
  log.error(chalk.magenta('Live-mutex: port could not be parsed to integer from command line input.'));
  log.error('Usage: lm_acquire_lock <key> <?port>');
  process.exit(1);
}

if (!v.key) {
  log.error(chalk.magenta('Live-mutex: no key passed at command line.'));
  log.error('Usage: lm_acquire_lock <key> <?port>');
  process.exit(1);
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

const clientOpts = Object.assign({keepLocksAfterDeath: true}, v);
const c = new Client(clientOpts);

c.emitter.on('info', function () {
  log.debug(...arguments);
});

c.emitter.on('warning', function () {
  log.warn(...arguments);
});

c.emitter.on('error', function () {
  log.error(...arguments);
});

c.ensure().then(function (c) {

  const lockOptions = Object.assign({ttl: null, keepLocksAfterDeath: true}, v);

  c.lock(v.key, lockOptions, function (e: any) {

    if (e) {
      log.error(chalk.magenta.bold(e && e.message || e));
      log.error(`To discover what is going on with the broker, use ${chalk.blueBright.bold('$ lm_inspect_broker -p <port> -h <host>')}.`);
      return process.exit(1);
    }

    log.debug(chalk.green.bold(`${chalk.italic('Acquired')} lock for key:`), `'${chalk.blueBright.bold(v.key)}'`);
    process.exit(0);

  });
});