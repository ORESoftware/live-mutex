'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const _ = require("lodash");
const fnArgs = require('function-arguments');
const suman_utils_1 = require("suman-utils");
const chalk = require("chalk");
const _suman = global.__suman = (global.__suman || {});
const general_1 = require("../helpers/general");
let cachedPromises = {};
exports.acquirePreDeps = function ($depList, depContainerObj, oncePostHash) {
    const depList = _.flattenDeep([$depList]);
    const verbosity = _suman.sumanOpts.verbosity || 5;
    const getAllPromises = function (key, $deps) {
        if (cachedPromises[key]) {
            return cachedPromises[key];
        }
        if (verbosity > 3) {
            _suman.log.info(chalk.cyan(`(suman.once.pre.js) => Beginning to source dep with key => '${key}'`));
        }
        const val = depContainerObj[key];
        let { subDeps, fn, timeout, props } = general_1.extractVals(val);
        if (!timeout || !Number.isInteger(timeout)) {
            timeout = 25000;
        }
        if (verbosity > 6) {
            _suman.log.info(`Maximum time allocated to source dependency with key => '${key}' is => `, timeout);
        }
        $deps.forEach(function (d) {
            if (d === key) {
                throw new Error('Circular dependency => existing deps => ' + util.inspect($deps) + ', ' +
                    'new dep => "' + key + '"');
            }
        });
        $deps.push(key);
        subDeps.forEach(function (d) {
            if ($deps.includes(d)) {
                throw new Error(' => Direct circular dependency => pre-existing deps => ' + util.inspect($deps) + ', ' +
                    'newly required dep => "' + d + '"');
            }
        });
        const acc = {};
        return cachedPromises[key] = Promise.all(subDeps.map(function (k) {
            return getAllPromises(k, $deps.slice(0)).then(function (v) {
                Object.assign(acc, v);
            });
        })).then(function ($$vals) {
            if (verbosity > 5 && subDeps.length > 0) {
                _suman.log.info(chalk.blue(`suman.once.pre.js => `
                    + `Finished sourcing the dependencies ${util.inspect(subDeps)} of key => '${key}'`));
            }
            let to;
            return new Promise(function (resolve, reject) {
                to = setTimeout(function () {
                    reject(new Error(`Suman dependency acquisition timed-out for dependency with key => '${key}'`));
                }, _suman.weAreDebugging ? 5000000 : timeout);
                if (verbosity > 5 || suman_utils_1.default.isSumanDebug()) {
                    _suman.log.info('suman.once.pre.js => Executing dep with key = "' + key + '"');
                }
                general_1.asyncHelper(key, resolve, reject, [acc], 1, fn);
            })
                .then(function (val) {
                clearTimeout(to);
                if (verbosity > 3 || suman_utils_1.default.isSumanDebug()) {
                    _suman.log.info(chalk.green.bold('suman.once.pre.js => Finished sourcing dep with key = "' + key + '"'));
                }
                _suman.integrantHashKeyVals[key] = val;
                return {
                    [key]: val
                };
            }, function (err) {
                clearTimeout(to);
                return Promise.reject(err);
            });
        });
    };
    const promises = depList.map(function (key) {
        return getAllPromises(key, []);
    });
    return Promise.all(promises).then(function (deps) {
        const obj = deps.reduce(Object.assign, {});
        if (!_suman.processIsRunner) {
            _suman.log.info(chalk.green.underline.bold('Finished with suman.once.pre.js dependencies.'), '\n');
        }
        return obj;
    }, function (err) {
        _suman.log.error(chalk.magenta('There was an error sourcing your dependencies in suman.once.pre.js.'));
        err && _suman.log.error(err.stack || util.inspect(err));
        !err && (err = new Error('No error was defined in error handler.'));
        return Promise.reject(err);
    });
};
