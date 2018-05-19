#!/usr/bin/env node
'use strict';

import {Client, log} from "./client";
const port = parseInt(process.argv[3] || process.env.live_mutex_port || '6970');
const key = process.argv[2] || process.env.live_mutex_key || '';

if (!Number.isInteger(port)) {
  log.error('Live-mutex: port could not be parsed to integer from command line input.');
  log.error('Usage: lm_acquire_lock <key> <?port>');
  process.exit(1);
}

if (!key) {
  log.error('Live-mutex: no key passed at command line.');
  log.error('Usage: lm_acquire_lock <key> <?port>');
  process.exit(1);
}

process.once('warning' as any, function (e: any) {
  log.error('process warning:', e && e.message || e);
});

process.once('unhandledRejection', function (err) {
  log.error('unhandledRejection:', err);
  process.exit(1);
});

process.once('uncaughtException', function (err) {
  log.error('uncaughtException:', err);
  process.exit(1);
});

new Client({port}).ensure().then(function (c) {
  
  c.unlock(key, {ttl: 6000}, function (e: any) {
    
    if (e) {
      log.error(e && e.message || e);
      log.error(`To discover what is going on with the broker, use '$ lm_inspect_broker -p <port> -h <host>'.`)
      return process.exit(1);
    }
    
    log.info('Unlocked lock for key:', key);
    process.exit(0);
    
  });
  
});