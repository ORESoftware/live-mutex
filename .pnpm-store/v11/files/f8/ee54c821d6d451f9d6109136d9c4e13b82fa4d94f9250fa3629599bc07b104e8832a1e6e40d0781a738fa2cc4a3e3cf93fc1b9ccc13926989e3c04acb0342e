'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const cp = require("child_process");
const chalk = require("chalk");
const async = require("async");
const _suman = global.__suman = (global.__suman || {});
exports.makeGetLatestSumanVersion = function (pkgDotJSON, projectRoot) {
    return function getLatestSumanVersion(cb) {
        async.race([
            function (cb) {
                setTimeout(cb, 2800);
            },
            function (cb) {
                cp.exec('npm view suman version', function (err, stdout, stderr) {
                    console.log('\n');
                    if (err || String(stdout).match(/error/i) || String(stderr).match(/error/)) {
                        return cb(null, {
                            error: err,
                            stderr,
                            stdout
                        });
                    }
                    _suman.log.info(chalk.cyan('Newest Suman version in the NPM registry:'), String(stdout).replace('\n', ''));
                    if (pkgDotJSON) {
                        _suman.log.info(chalk.cyan('Locally installed Suman version:'), pkgDotJSON.version);
                    }
                    cb(null);
                });
            }
        ], cb);
    };
};
