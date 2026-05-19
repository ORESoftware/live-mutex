'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require('path');
const util = require("util");
const chalk = require("chalk");
const sortBy = require('lodash.sortby');
const includes = require('lodash.includes');
const flattenDeep = require('lodash.flattendeep');
const intersection = require('lodash.intersection');
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const weAreDebugging = su.weAreDebugging;
const started = [];
const ended = [];
const arrayOfVals = [];
function default_1(order) {
    const config = _suman.sumanConfig;
    const maxProcs = _suman.maxProcs;
    let interval = 10000;
    let timeout = 1000;
    if (_suman.sumanOpts && _suman.sumanOpts.verbosity > 2) {
        setInterval(function () {
            setTimeout(function () {
                const startedButNotEnded = started.filter(function ($item) {
                    return ended.every(function (item) {
                        return (String(item.value.testPath) !== String($item.value.testPath));
                    });
                }).map(function (item) {
                    return '\n  ' + item.value.testPath;
                });
                if (startedButNotEnded.length > 1) {
                    console.log('\n\n', chalk.bgCyan.black.bold(' => Suman message => The following test ' +
                        'processes have started but not ended yet:'), chalk.cyan(startedButNotEnded));
                    console.log('\n\n');
                }
            }, timeout += 8000);
        }, interval);
    }
    function findQueuedCPsToStart(obstructed, queuedCPsObj) {
        const queuedCPs = queuedCPsObj.queuedCPs;
        const obstructedKeysOfStartedButNotEnded = function () {
            const testPathsofCurrentRunningProcesses = [];
            const $obstructedKeysOfStartedButNotEnded = flattenDeep(started.filter(function ($item) {
                const isEvery = ended.every(function (item) {
                    return (String(item.value.testPath) !== String($item.value.testPath));
                });
                if (isEvery) {
                    testPathsofCurrentRunningProcesses.push($item.value.testPath);
                }
                return isEvery;
            }).map(function (item) {
                return item.value.obstructs;
            }));
            return {
                $obstructedKeysOfStartedButNotEnded,
                testPathsofCurrentRunningProcesses
            };
        };
        const obstructedTestPathsOfCurrentlyRunningProcesses = function () {
            const $obstructedKeysOfStartedButNotEnded = obstructedKeysOfStartedButNotEnded().$obstructedKeysOfStartedButNotEnded;
            return arrayOfVals.filter(function (item) {
                return includes($obstructedKeysOfStartedButNotEnded, item.key);
            }).map(function (item) {
                return item.value.testPath;
            });
        };
        const haveNotStarted = function () {
            return arrayOfVals.filter(function ($item) {
                return started.every(function (item) {
                    return item.value.testPath !== $item.value.testPath;
                });
            }).map(function (item) {
                return item.value.testPath;
            });
        };
        const obstructedTestPaths = function (testPath) {
            const obstructList = flattenDeep(arrayOfVals.filter(function (item) {
                return String(item.value.testPath) === String(testPath);
            }).map(function (item) {
                return item.value.obstructs;
            }));
            return arrayOfVals.filter(function (item) {
                return includes(obstructList, item.key);
            }).map(function (item) {
                return item.value.testPath;
            });
        };
        const queuedCPsToStartNext = [];
        const indexesToRemove = [];
        queuedCPs.forEach(function (fn, index) {
            const testPath = fn.testPath;
            const $obstructedTestPaths = obstructedTestPaths(testPath);
            const $testPathsofCurrentRunningProcesses = obstructedKeysOfStartedButNotEnded().testPathsofCurrentRunningProcesses;
            const $obstructedTestPathsOfCurrentlyRunningProcesses = obstructedTestPathsOfCurrentlyRunningProcesses();
            const thisTestPathHasNotBeenRunYet = includes(haveNotStarted(), testPath);
            const testPathIsNotObstructed = !includes($obstructedTestPathsOfCurrentlyRunningProcesses, testPath);
            const testPathsOwnObstructsListDoesntExcludeCurrentlyRunningProcesses = intersection($obstructedTestPaths, $testPathsofCurrentRunningProcesses).length < 1;
            let isNotMaxedOut = $testPathsofCurrentRunningProcesses.length < maxProcs;
            if (isNotMaxedOut
                && thisTestPathHasNotBeenRunYet
                && testPathIsNotObstructed
                && testPathsOwnObstructsListDoesntExcludeCurrentlyRunningProcesses) {
                started.push(arrayOfVals.filter(function (item) {
                    return String(item.value.testPath) === String(fn.testPath);
                })[0]);
                indexesToRemove.push(index);
                queuedCPsToStartNext.push(fn);
            }
        });
        queuedCPsObj.queuedCPs = queuedCPs.filter(function (item, index) {
            return !includes(indexesToRemove, index);
        });
        return queuedCPsToStartNext;
    }
    return {
        canRunNext: function () {
            return started.length - ended.length < maxProcs;
        },
        getStartedAndEnded: function () {
            return {
                started,
                ended
            };
        },
        determineInitialStarters: function (files) {
            Object.keys(order).forEach(function (key) {
                const value = order[key];
                const testPath = value.testPath;
                if (includes(files, testPath)) {
                    arrayOfVals.push({
                        key,
                        value: {
                            testPath,
                            obstructs: value.obstructs
                        }
                    });
                }
            });
            files.forEach(function (file) {
                const length = arrayOfVals.filter(function (item) {
                    return String(item.value.testPath) === String(file);
                }).length;
                if (length < 1) {
                    arrayOfVals.push({
                        key: 'SUMAN_RESERVED_KEY',
                        value: {
                            testPath: file,
                            obstructs: []
                        }
                    });
                }
            });
            const vals = sortBy(arrayOfVals, function (item) {
                return -1 * item.value.obstructs.length;
            });
            vals.forEach(function (val) {
                const notObstructedFirstCheck = started.every(function (item) {
                    return !(includes(item.value.obstructs, val.key));
                });
                const notObstructedSecondCheck = val.value.obstructs.every(function (key) {
                    return started.every(function ($item) {
                        return String($item.key) !== String(key);
                    });
                });
                if (notObstructedFirstCheck && notObstructedSecondCheck && started.length < maxProcs) {
                    started.push(val);
                }
            });
        },
        shouldFileBeBlockedAtStart: function (file) {
            for (let i = 0; i < started.length; i++) {
                let s = started[i];
                if (String(s.value.testPath) === String(file)) {
                    return false;
                }
            }
            return true;
        },
        releaseNextTests: function releaseNextTests(testPath, queuedCPsObj) {
            const val = started.filter(function (item) {
                return String(item.value.testPath) === String(testPath);
            })[0];
            ended.push(val);
            if (su.isSumanDebug()) {
                console.log(' => SUMAN_DEBUG => Test ended:', util.inspect(val));
            }
            const obstructed = flattenDeep(val.value.obstructs, arrayOfVals.filter(function (item) {
                return includes(item.value.obstructs, val.key);
            }).map(function (item) {
                return item.value.obstructs;
            }));
            const cpFns = findQueuedCPsToStart(obstructed, queuedCPsObj);
            cpFns.forEach(function (fn) {
                _suman.log.info('Test path started and is now running => ', fn.testPath);
                fn.call(null);
            });
        }
    };
}
exports.default = default_1;
;
