'use strict';

import {Broker, log} from "./broker";
import chalk from "chalk";
let port = parseInt(process.argv[2] || process.env.live_mutex_port || '6970');
const index = process.argv.indexOf('--json');

let v = {port} as any;

if (index > 0) {

  try {
    v = JSON.parse(process.argv[index + 1]);
  }
  catch (err) {
    log.error(chalk.magenta(`Could not parse your --json argument, try --json '{"port":3091}'.`));
    throw chalk.magentaBright(err.message);
  }

  port = v.port = (v.port || port);
}

if (!Number.isInteger(port)) {
  log.error(chalk.magenta('Live-mutex: port could not be parsed to integer from command line input.'));
  log.error('Usage: lm_acquire_lock <key> <?port>');
  process.exit(1);
}

process.once('warning' as any, function (e: any) {
  log.error('process warning:', e && e.message || e);
});

process.once('unhandledRejection', function (e: any) {
  log.error('unhandledRejection:', e && e.message || e);
});

process.once('uncaughtException', function (e: any) {
  log.error('uncaughtException:', e && e.message || e);
});

const b = new Broker(v);

process.once('exit', function () {
  b.close(null);
});

b.emitter.on('warning', function () {
  log.warn(...arguments);
});

b.ensure().then(function (b) {
  log.debug(chalk.bold('Started server on port:'), chalk.magenta.bold(String(b.getPort())));
})
.catch(function (err) {
  log.error('caught:', err && err.message || err);
  process.exit(1);
});