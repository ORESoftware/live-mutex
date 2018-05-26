#!/usr/bin/env node
'use strict';

import {Broker, log} from "./broker";

let port = parseInt(process.argv[2] || process.env.live_mutex_port || '6970');
const index = process.argv.indexOf('--json');

let v = {port} as any;

if(index > 0){
  
  try{
     v = JSON.parse(process.argv[index + 1]);
  }
  catch(err){
    console.error(`Could not parse your --json argument, try --json '{"port":3091}'.`);
    throw err.message;
  }
  
  port = v.port = (v.port || port);
}


if (!Number.isInteger(port)) {
  log.error('Live-mutex: port could not be parsed to integer from command line input.');
  log.error('Usage: lm_acquire_lock <key> <?port>');
  process.exit(1);
}

process.once('warning' as any, function (e: any) {
  log.error('process warning:', e && e.message || e);
});

process.once('error' as any, function (e: any) {
  log.error('process error:', e && e.message || e);
});

process.once('unhandledRejection', function (e: any) {
  log.error('unhandledRejection:', e && e.message || e);
});

process.once('uncaughtException', function (e: any) {
  log.error('uncaughtException:', e && e.message || e);
});

new Broker(v).ensure().then(function (c) {
  log.info('Started server on port:', c.getPort());
})
.catch(function (err) {
  log.error('caught:', err && err.message || err);
  process.exit(1);
});