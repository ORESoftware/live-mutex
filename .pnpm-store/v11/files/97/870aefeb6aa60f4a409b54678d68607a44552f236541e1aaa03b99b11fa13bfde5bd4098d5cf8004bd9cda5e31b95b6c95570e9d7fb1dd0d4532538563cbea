"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const fs = require("fs");
const path = require("path");
const tsc_multi_watch_1 = require("tsc-multi-watch");
const _suman = global.__suman = (global.__suman || {});
exports.run = function (opts) {
    const { projectRoot } = _suman;
    const sumanMultiLock = path.resolve(projectRoot + '/suman.lock');
    fs.writeFile(sumanMultiLock, { flag: 'wx' }, function (err) {
        if (err && !opts.force) {
            _suman.log.error('Could not acquire lock. Perhaps another similar process is already running. Use --force to override.');
            return;
        }
        process.once('exit', function () {
            _suman.log.info('cleaning up sumanMultiLock.');
            try {
                fs.unlinkSync(sumanMultiLock);
            }
            catch (err) {
            }
        });
        const sumanMultiReadyLock = path.resolve(projectRoot + '/suman-watch.lock');
        tsc_multi_watch_1.default({}, function (err) {
            if (err) {
                console.error(err.stack || err);
                return process.exit(1);
            }
            fs.writeFile(sumanMultiReadyLock, { flag: 'wx' }, function (err) {
                if (err) {
                    _suman.log.error(err.stack || err);
                }
                else {
                    _suman.log.info('successful started multi watch process.');
                }
                let cleanUp = function () {
                    console.log('\n');
                    _suman.log.info('cleaning up sumanMultiReadyLock.');
                    try {
                        fs.unlinkSync(sumanMultiReadyLock);
                    }
                    catch (err) {
                    }
                    process.exit(0);
                };
                process.on('SIGINT', cleanUp);
                process.once('exit', cleanUp);
            });
        });
    });
};
