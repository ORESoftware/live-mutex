'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const fs = require("fs");
const path = require("path");
const util = require("util");
const assert = require("assert");
const chalk = require("chalk");
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const cwd = process.cwd();
const socketio_server_1 = require("./socketio-server");
const runnerDebugLogPath = _suman.sumanRunnerStderrStreamPath =
    path.resolve(_suman.sumanHelperDirRoot + '/logs/runner-debug.log');
exports.run = function (obj) {
    const runObj = obj.runObj;
    const strm = _suman.sumanStderrStream = fs.createWriteStream(runnerDebugLogPath);
    strm.write('\n\n### Suman runner start ###\n\n');
    strm.write('Beginning of run at ' + Date.now() + ' = [' + new Date() + ']' + '\n');
    strm.write('Suman command issued from the following directory "' + cwd + '"\n');
    strm.write('Suman "process.argv" => \n' + util.inspect(process.argv) + '\n');
    const oncePath = path.resolve(_suman.sumanHelperDirRoot + '/suman.once.pre.js');
    let runOnce;
    try {
        runOnce = require(oncePath);
        assert(typeof runOnce === 'function', 'runOnce is not a function.');
    }
    catch (err) {
        if (err instanceof assert.AssertionError) {
            console.error('Your suman.once.js module is defined at the root of your project,\n' +
                'but it does not export a function and/or return an object from that function.');
            throw err;
        }
    }
    runOnce = runOnce || function () { return { dependencies: {} }; };
    const orderPath = path.resolve(_suman.sumanHelperDirRoot + '/suman.order.js');
    let fn, order = null;
    try {
        fn = require(orderPath);
        if (fn) {
            order = fn();
        }
    }
    catch (err) {
        if (fn) {
            throw new Error(' => Your suman.order.js file needs to export a function.');
        }
        else if (!_suman.usingDefaultConfig || su.isSumanDebug()) {
            _suman.log.warning(chalk.magenta('warning => Your suman.order.js file could not be located,' +
                ' given the following path to your "<suman-helpers-dir>" => ') +
                '\n' + chalk.bgBlack.cyan(_suman.sumanHelperDirRoot));
        }
    }
    if (order) {
        require('./validate-suman.order.js').run(order);
    }
    socketio_server_1.initializeSocketServer(function (err, port) {
        assert(Number.isInteger(port), 'port must be an integer');
        _suman.socketServerPort = port;
        require('./runner').run(runObj, runOnce, order);
    });
};
