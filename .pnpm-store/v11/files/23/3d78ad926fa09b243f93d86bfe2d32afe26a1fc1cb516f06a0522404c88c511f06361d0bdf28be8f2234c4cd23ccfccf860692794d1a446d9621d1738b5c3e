'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const os = require('os');
const util = require("util");
const _suman = global.__suman = (global.__suman || {});
const sumanServer = require('./create-suman-server');
exports.run = function (sumanServerInstalled, sumanConfig, serverName) {
    if (!sumanServerInstalled) {
        throw new Error(' => Suman server is not installed yet => Please use "$ suman --use-server" in your local project.');
    }
    sumanServer({
        config: sumanConfig,
        serverName: serverName || os.hostname()
    }, function (err, val) {
        if (err) {
            console.error(err.stack || err);
            process.nextTick(function () {
                process.exit(1);
            });
        }
        else {
            console.log('Suman server should be live at =>', util.inspect(val));
            process.nextTick(function () {
                process.exit(0);
            });
        }
    });
};
