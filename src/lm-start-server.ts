'use strict';

import {Broker, log} from "./broker";
import * as fs from 'fs';
import chalk from "chalk";
import util = require('util');
import * as path from "path";
import {inspectError} from "./shared-internal";

const cp = require('child_process');

let host = process.env.live_mutex_host || '0.0.0.0';
let port = parseInt(process.env.live_mutex_port || '6970');
const index = process.argv.indexOf('--json');
const useUDS = process.env.use_uds === 'yes' || process.argv.indexOf('--use-uds') > 1;


// @ts-ignore
let v = {port, host} as any;

if (index > 1) {
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

if (useUDS || v.udsPath) {
  v.udsPath = path.resolve(process.env.HOME + '/.lmx/uds.sock');
  
  try {
    fs.mkdirSync(path.resolve(process.env.HOME + '/.lmx'), {recursive: true});
  }
  catch (err) {
    log.error('Could not create .lmx dir in user home.');
    log.error(err);
    process.exit(1);
  }
  
  try{
    fs.unlinkSync(v.udsPath)
  }
  catch(err){
     // ignore
  }
  
}




if (!Number.isInteger(port)) {
  log.error(chalk.magenta('Live-mutex: port could not be parsed to integer from command line input.'));
  log.error('Usage: lmx-start-server <key> <?port>');
  process.exit(1);
}

process.once('warning' as any, function (e: any) {
  log.error('process warning:', chalk.magenta(inspectError(e)));
});

process.once('unhandledRejection', function (e: any) {
  log.error('unhandled-rejection:', chalk.magenta(inspectError(e)));
});

process.once('uncaughtException', function (e: any) {
  log.error('uncaught-exception:', chalk.magenta(inspectError(e)));
});

const b = new Broker(v);

process.once('exit', function () {
  b.close(null);
});

b.emitter.on('warning', function () {
  log.warn(...arguments);
});

b.emitter.on('error', function () {
  log.error(...arguments);
});


b.ensure().then(b => {
  
   log.info(chalk.bold('LMX broker version:'), chalk.blueBright(b.getVersion()));
   log.info(chalk.bold('LMX broker listening on:'), chalk.cyan.bold(String(b.getListeningInterface())));
  
   // const k = cp.spawn('ls', ['-a','/uds']);
   //
   // k.stdout.pipe(process.stdout);
   // k.stderr.pipe(process.stderr);
  
 })
 .catch(function (err) {
   log.error('broker launch error:', inspectError(err));
   process.exit(1);
 });