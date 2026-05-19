'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require('path');
const chalk = require("chalk");
const sortBy = require('lodash.sortby');
const includes = require('lodash.includes');
const flattenDeep = require('lodash.flattendeep');
const intersection = require('lodash.intersection');
const _suman = global.__suman = (global.__suman || {});
const started = [];
const ended = [];
function default_1(order) {
    const config = _suman.sumanConfig;
    const maxProcs = _suman.maxProcs;
    let interval = 10000;
    let initialTimeout = 5000;
    let increaseEachTime = 6000;
    if (true || _suman.sumanOpts && _suman.sumanOpts.verbosity > 2) {
        setInterval(function () {
            setTimeout(function () {
                _suman.log.info('number of processes already started', started.length);
                _suman.log.info('number of processes already ended', ended.length);
                const startedButNotEnded = started.filter(function ($item) {
                    return ended.every(function (item) {
                        return (String(item.testPath) !== String($item.testPath));
                    });
                })
                    .map(function (item) {
                    return '\n  ' + item.testPath;
                });
                if (startedButNotEnded.length > 0) {
                    console.log('\n');
                    _suman.log.info(chalk.bgCyan.yellow(' The following test processes have started but not ended yet: '));
                    console.log(chalk.cyan.bold(String(startedButNotEnded)));
                    console.log('\n');
                }
            }, initialTimeout += increaseEachTime);
        }, interval);
    }
    const findQueuedCPsToStart = function (queuedCPsObj) {
        if (started.length - ended.length < maxProcs) {
            return queuedCPsObj.queuedCPs.pop();
        }
    };
    return {
        runNext: function (fn) {
            if (started.length - ended.length < maxProcs) {
                started.push(fn);
                fn.call(null);
                return true;
            }
        },
        getStartedAndEnded: function () {
            return {
                started,
                ended
            };
        },
        determineInitialStarters: function (files) {
            throw new Error('no longer used.');
        },
        shouldFileBeBlockedAtStart: function (file) {
            throw new Error('no longer used.');
        },
        releaseNextTests: function releaseNextTests(testPath, queuedCPsObj) {
            const val = started.filter(function (item) {
                return String(item.testPath) === String(testPath);
            })[0];
            ended.push(val);
            const cpFn = findQueuedCPsToStart(queuedCPsObj);
            if (cpFn) {
                started.push(cpFn);
                _suman.log.info(chalk.cyan.bold('Test path was blocked, but is now running => '), chalk.gray(`'${cpFn.testPath}'.`));
                cpFn.call(null);
            }
        }
    };
}
exports.default = default_1;
;
