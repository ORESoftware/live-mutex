'use strict';

import {Broker1, log} from "./broker-1";
import {LMXHttpServer} from "./http-server";
import {initOtel, routineEnter, shutdownOtel} from "./routine";
import * as fs from 'fs';
import chalk from "chalk";
import * as util from 'util';
import * as path from "path";
import {inspectError} from "./shared-internal";
import * as cp from 'child_process';

// Initialise OpenTelemetry as the very first thing the broker process
// does, before any spans get created. Reads `OTEL_EXPORTER_OTLP_ENDPOINT`
// from the environment; no-op when unset, so dev/test runs stay quiet.
initOtel();
{
  const routineId = 'ddl-routine-lm-start-server-Hp9zQ';
  routineEnter(routineId, 'lm-start-server-bootstrap');
}

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
  if(process.env.lmx_log_errors != 'nope') {
    log.error('process warning:', chalk.magenta(inspectError(e)));
  }
});

process.once('unhandledRejection', function (e: any) {
  if(process.env.lmx_log_errors != 'nope') {
    log.error('unhandled-rejection:', chalk.magenta(inspectError(e)));
  }
});

process.once('uncaughtException', function (e: any) {
  if(process.env.lmx_log_errors != 'nope') {
    log.error('uncaught-exception:', chalk.magenta(inspectError(e)));
  }
});

const b = new Broker1(v);

process.once('exit', function () {
  const routineId = 'ddl-routine-lm-start-server-exit-Tr4';
  routineEnter(routineId, 'lm-start-server.onExit');
  // OTel flush is best-effort; the SDK runs `shutdown()` async but `exit`
  // handlers must be sync, so we kick it off and don't await — any
  // in-flight spans get a few hundred ms of wall time before the process
  // tears down listeners.
  shutdownOtel().catch(() => {});
  b.close(null);
});

b.emitter.on('warning', function () {
  log.warn(...arguments);
});

b.emitter.on('error', function () {
  log.error(...arguments);
});


b.ensure().then(async b => {

   log.info(chalk.bold('LMX broker version:'), chalk.blueBright(b.getVersion()));
   log.info(chalk.bold('LMX broker listening on:'), chalk.cyan.bold(String(b.getListeningInterface())));

   // Optional HTTP front-end. Off by default to avoid surprising
   // existing deployments — opt in with `LMX_HTTP_PORT` (any positive
   // integer). The HTTP server runs in this same process and talks to
   // the broker over loopback; on UDS-only setups it dials the same
   // socket file.
   const httpPortRaw = process.env.LMX_HTTP_PORT;
   if (httpPortRaw) {
       const httpPort = Number.parseInt(httpPortRaw, 10);
       if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) {
           log.error(chalk.red(`Ignoring invalid LMX_HTTP_PORT='${httpPortRaw}' (expected 1..65535).`));
       } else {
           const httpHost = process.env.LMX_HTTP_HOST || '0.0.0.0';
           const httpServer = new LMXHttpServer(b, {port: httpPort, host: httpHost});
           try {
               await httpServer.start();
               log.info(chalk.bold('LMX HTTP status server listening on:'),
                   chalk.cyan.bold(`http://${httpHost}:${httpPort}/`));
               process.once('exit', () => { httpServer.stop().catch(() => {}); });
           } catch (err) {
               log.error('HTTP server failed to start:', inspectError(err as Error));
           }
       }
   }
})
 .catch(function (err) {
   log.error('broker launch error:', inspectError(err));
   process.exit(1);
 });
