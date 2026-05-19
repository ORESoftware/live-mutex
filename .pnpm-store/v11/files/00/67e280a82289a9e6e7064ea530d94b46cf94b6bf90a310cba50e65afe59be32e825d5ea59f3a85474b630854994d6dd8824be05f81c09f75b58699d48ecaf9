'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const cp = require("child_process");
const _suman = global.__suman = (global.__suman || {});
exports.run = function (opts) {
    const script = path.resolve(__dirname + '/../../scripts/suman-postinstall.sh');
    console.log('\n');
    console.log(' => Suman will run its postinstall routine.');
    console.log('\n');
    const k = cp.spawn(script);
    k.stdout.pipe(process.stdout);
    k.stderr.pipe(process.stderr);
    k.once('close', function (code) {
        process.exit(code || 0);
    });
};
