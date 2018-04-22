#!/usr/bin/env node
'use strict';

import {Client} from "../client";

const port = parseInt(process.argv[3] || process.env.lm_port || '6970');
const key = process.argv[2] || process.env.lm_key || '';


if(!Number.isInteger(port)){
  console.error('Live-mutex: port could not be parsed to integer from command line input.');
  console.error('Usage: lm_acquire_lock <key> <?port>');
  process.exit(1);
}

if (!key) {
  console.error('Live-mutex: no key passed at command line.');
  console.error('Usage: lm_acquire_lock <key> <?port>');
  process.exit(1);
}

const client = new Client({port});

client.ensure().then(function (c) {
  c.unlock(key, {ttl:6000}, function (err) {       // c and client are same object
    
    if (err) {
      console.error(err.stack || err);
      process.exit(1);
    }
    else {
      console.log('Unlocked lock for key:', key);
      process.exit(0);
    }
  });
});