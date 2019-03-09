'use strict';

import {Broker, log} from "./broker";
import chalk from "chalk";
import util = require('util');
let host = process.argv[3] || process.env.live_mutex_host || '0.0.0.0';
let port = parseInt(process.argv[2] || process.env.live_mutex_port || '6970');
const index = process.argv.indexOf('--json');

let v = {port,host} as any;

if (index > 0) {

  try {
    v = JSON.parse(process.argv[index + 1]);
  }
  catch (err) {
    log.error(chalk.magenta(`Could not parse your --json argument, try --json '{"port":3091}'.`));
    throw chalk.magentaBright(err.message);
  }

  host = v.host = (v.host || host);
  port = v.port = (v.port || port);
}

if (!Number.isInteger(port)) {
  log.error(chalk.magenta('Live-mutex: port could not be parsed to integer from command line input.'));
  log.error('Usage: lm_acquire_lock <key> <?port>');
  process.exit(1);
}

process.once('warning' as any, function (e: any) {
  log.error('process warning:', chalk.magenta(util.inspect(e)));
});

process.once('unhandledRejection', function (e: any) {
  log.error('unhandled-rejection:', chalk.magenta(util.inspect(e)));
});

process.once('uncaughtException', function (e: any) {
  log.error('uncaught-exception:', chalk.magenta(util.inspect(e)));
});

const b = new Broker(v);

process.once('exit', function () {
  b.close(null);
});

b.emitter.on('warning', function () {
  log.warn(...arguments);
});

b.ensure().then(function (b) {
  log.info(chalk.bold('Started server on port:'), chalk.cyan.bold(String(b.getPort())));
})
.catch(function (err) {
  log.error('caught:', err && err.message || err);
  process.exit(1);
});