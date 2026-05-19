'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const cp = require("child_process");
const assert = require("assert");
const chalk = require("chalk");
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
exports.run = function () {
    const runSumanWithPromise = function (runOptions) {
        if (runOptions.useGlobalVersion && runOptions.useLocalVersion) {
            throw new Error('Suman run routine cannot use both local and global versions -> check your options object passed to suman.run()');
        }
        if (runOptions.env && su.isObject(runOptions.env)) {
            throw new Error('"env" property must be a plain object.');
        }
        if (runOptions.files && !Array.isArray(runOptions.files)) {
            throw new Error('"files" must be an Array.');
        }
        else if (runOptions.files) {
            runOptions.files.forEach(function (v) {
                assert.equal(typeof v, 'string');
            });
        }
        if (runOptions.args && !Array.isArray(runOptions.args)) {
            throw new Error('"args" property must be an array.');
        }
        else if (runOptions.args) {
            runOptions.args.forEach(function (v) {
                assert.equal(typeof v, 'string');
            });
        }
        let executable, args = runOptions.args || [], files = runOptions.files || [], env = runOptions.env || {}, pauseStdio = runOptions.pauseStdio !== false;
        if (args.length < 1 && files.length < 1) {
            throw new Error('You must pass at least one argument or file to the suman executable, try "--" or "--default", if nothing else.');
        }
        if (runOptions.useGlobalVersion) {
            executable = 'suman';
        }
        else if (runOptions.useLocalVersion) {
            executable = path.resolve(_suman.projectRoot + '/node_modules/.bin/suman');
        }
        else {
            executable = 'suman';
        }
        return new Promise(function (resolve, reject) {
            const cmd = [executable].concat(args.concat(files)).join(' ');
            _suman.log.good('suman will run the following command:');
            _suman.log.good(cmd);
            const k = cp.spawn('bash', [], {
                env: Object.assign({}, process.env, env),
            });
            k.once('error', reject);
            k.stdin.write(cmd);
            k.stdin.end('\n');
            if (pauseStdio) {
                k.stdout.pause();
                k.stderr.pause();
            }
            resolve({
                sumanProcess: k
            });
        })
            .catch(function (err) {
            console.log();
            _suman.log.error(err.stack);
            console.error();
            if (runOptions.useLocalVersion) {
                _suman.log.error(chalk.red.bold('Local suman version may not be installed at this path:'));
                _suman.log.error(executable);
            }
            if (runOptions.useGlobalVersion) {
                _suman.log.error(chalk.red.bold('Globally installed suman version may not be available.'));
                try {
                    _suman.log.error(chalk.gray.bold('The `which suman` command yields the following:'));
                    _suman.log.error(chalk.bold(String(cp.execSync('which suman'))));
                }
                catch (err) {
                    _suman.log.error(err.stack);
                }
            }
            return Promise.reject(err);
        });
    };
    runSumanWithPromise.cb = function (runOptions, cb) {
        runSumanWithPromise(runOptions).then(function (val) {
            cb(null, val);
        }, cb);
    };
    return runSumanWithPromise;
};
