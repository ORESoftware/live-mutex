'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const assert = require("assert");
const EE = require("events");
const chalk = require("chalk");
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const socketio_child_client_1 = require("../index-helpers/socketio-child-client");
const rb = _suman.resultBroadcaster = _suman.resultBroadcaster || new EE();
const sumanReporters = _suman.sumanReporters = _suman.sumanReporters || [];
const reporterRets = _suman.reporterRets = _suman.reporterRets || [];
let loaded = false;
let getReporterFn = function (fn) {
    return fn.default || fn.loadReporter || fn;
};
let loadReporter = function (rpath) {
    try {
        let fullPath;
        try {
            fullPath = require.resolve(rpath);
        }
        catch (err) {
            fullPath = require.resolve(path.resolve(_suman.projectRoot + '/' + rpath));
        }
        let fn = require(fullPath);
        fn = getReporterFn(fn);
        assert(typeof fn === 'function', 'Suman implementation error - reporter module format fail.');
        fn.reporterPath = fullPath;
        return fn;
    }
    catch (err) {
        _suman.log.error(`could not load reporter at path "${rpath}".`);
        _suman.log.error(err.stack);
    }
};
exports.run = function () {
    if (loaded) {
        return;
    }
    else {
        loaded = true;
    }
    const sumanOpts = _suman.sumanOpts;
    _suman.currentPaddingCount = _suman.currentPaddingCount || { val: 0 };
    const optsCopy = Object.assign({}, sumanOpts);
    let fn, client;
    if (sumanReporters.length < 1) {
        try {
            if (window) {
                if (window.__karma__) {
                    _suman.log.info('Attempting to load karma reporter.');
                    fn = loadReporter('suman-reporters/modules/karma-reporter');
                }
                else {
                    _suman.log.info('Attempting to load websocket reporter.');
                    fn = loadReporter('suman-reporters/modules/websocket-reporter');
                    client = socketio_child_client_1.getClient();
                }
            }
        }
        catch (err) {
            if (su.vgt(7)) {
                _suman.log.warning(chalk.yellow.bold(err.message));
            }
            if (_suman.inceptionLevel > 0 || sumanOpts.$useTAPOutput || sumanOpts.$useTAPJSONOutput || _suman.usingRunner) {
                su.vgt(6) && _suman.log.info('last-ditch effort to load a reporter: loading "tap-json-reporter"');
                fn = loadReporter('suman-reporters/modules/tap-json-reporter');
            }
            else {
                su.vgt(6) && _suman.log.info('last-ditch effort to load a reporter: loading "std-reporter"');
                fn = loadReporter('suman-reporters/modules/std-reporter');
            }
        }
        assert(typeof fn === 'function', 'Suman implementation error - reporter fail - ' +
            'reporter does not export a function. Please report this problem.');
        sumanReporters.push(fn.reporterPath);
        reporterRets.push(fn.call(null, rb, optsCopy, {}, client));
    }
};
