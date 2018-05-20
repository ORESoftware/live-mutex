#!/usr/bin/env node
'use strict';

import {Broker, log} from "./broker";

const port = parseInt(process.argv[3] || process.env.live_mutex_port || '6970');

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

new Broker({port}).ensure().then(function (c) {
  log.info('Started server on port:', port);
})
.catch(function (err) {
  log.error('caught:', err && err.message || err);
  process.exit(1);
});