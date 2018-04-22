#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("../client");
var port = parseInt(process.argv[3] || process.env.lm_port || '6970');
var key = process.argv[2] || process.env.lm_key || '';
if (!Number.isInteger(port)) {
    console.error('Live-mutex: port could not be parsed to integer from command line input.');
    console.error('Usage: lm_acquire_lock <key> <?port>');
    process.exit(1);
}
if (!key) {
    console.error('Live-mutex: no key passed at command line.');
    console.error('Usage: lm_acquire_lock <key> <?port>');
    process.exit(1);
}
var client = new client_1.Client({ port: port });
client.ensure().then(function (c) {
    c.lock(key, { ttl: 6000 }, function (err) {
        if (err) {
            console.error(err.stack || err);
            process.exit(1);
        }
        else {
            console.log('Acquired lock for key:', key);
            process.exit(0);
        }
    });
});
