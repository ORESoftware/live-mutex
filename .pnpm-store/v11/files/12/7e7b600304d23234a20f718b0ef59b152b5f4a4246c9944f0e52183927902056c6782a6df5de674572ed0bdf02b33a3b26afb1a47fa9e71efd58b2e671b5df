'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const EE = require("events");
const async = require("async");
const suman_events_1 = require("suman-events");
const _ = require("lodash");
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const make_handle_test_1 = require("./make-handle-test");
const make_handle_each_1 = require("./make-handle-each");
const general_1 = require("../helpers/general");
const rb = _suman.resultBroadcaster = _suman.resultBroadcaster || new EE();
const testErrors = _suman.testErrors = _suman.testErrors || [];
const errors = _suman.sumanRuntimeErrors = _suman.sumanRuntimeErrors || [];
const getAllBeforesEaches = function (zuite) {
    const beforeEaches = [];
    beforeEaches.unshift(zuite.getBeforeEaches());
    if (!zuite.alreadyHandledAfterAllParentHooks) {
        zuite.alreadyHandledAfterAllParentHooks = true;
        beforeEaches.unshift(zuite.getAfterAllParentHooks());
    }
    const getParentBefores = function (parent) {
        beforeEaches.unshift(parent.getBeforeEaches());
        if (parent.parent) {
            getParentBefores(parent.parent);
        }
    };
    if (zuite.parent) {
        getParentBefores(zuite.parent);
    }
    return _.flatten(beforeEaches);
};
const getAllAfterEaches = function (zuite) {
    const afterEaches = [];
    afterEaches.push(zuite.getAfterEaches());
    const getParentAfters = function (parent) {
        afterEaches.push(parent.getAfterEaches());
        if (parent.parent) {
            getParentAfters(parent.parent);
        }
    };
    if (zuite.parent) {
        getParentAfters(zuite.parent);
    }
    return _.flatten(afterEaches);
};
const stckMapFn = function (item, index) {
    const fst = _suman.sumanOpts && _suman.sumanOpts.full_stack_traces;
    if (!item) {
        return '';
    }
    if (index === 0) {
        return '\t' + item;
    }
    if (fst) {
        return su.padWithXSpaces(4) + item;
    }
    if ((String(item).match(/\//) || String(item).match('______________')) && !String(item).match(/\/node_modules\//) &&
        !String(item).match(/internal\/process\/next_tick.js/)) {
        return su.padWithXSpaces(4) + item;
    }
};
const handleTestError = function (err, test) {
    if (_suman.uncaughtExceptionTriggered) {
        _suman.log.error(`runtime error => "UncaughtException:Triggered" => halting program.\n[${__filename}]`);
        return;
    }
    if (err) {
        if (err instanceof Error) {
            test.error = err;
            test.errorDisplay = String(err.stack).split('\n')
                .concat(`\t${su.repeatCharXTimes('_', 70)}`)
                .map(stckMapFn)
                .filter(item => item)
                .join('\n')
                .concat('\n');
        }
        else if (typeof err.stack === 'string') {
            test.error = err;
            test.errorDisplay = String(err.stack).split('\n')
                .concat(`\t${su.repeatCharXTimes('_', 70)}`)
                .map(stckMapFn)
                .filter(item => item)
                .join('\n')
                .concat('\n');
        }
        else {
            throw new Error('Suman internal implementation error => invalid error format, please report this.');
        }
        if (su.isSumanDebug()) {
            _suman.writeTestError('\n\nTest error: ' + test.desc + '\n\t' + 'stack: ' + test.error.stack + '\n\n');
        }
        testErrors.push(test.error);
    }
    if (test.error) {
        test.error.isFromTest = true;
    }
    return test.error;
};
exports.makeTheTrap = function (suman, gracefulExit) {
    const handleTest = make_handle_test_1.makeHandleTest(suman, gracefulExit);
    const handleBeforeOrAfterEach = make_handle_each_1.makeHandleBeforeOrAfterEach(suman, gracefulExit);
    return function runTheTrap(self, test, opts, cb) {
        if (_suman.uncaughtExceptionTriggered) {
            _suman.log.error(`runtime error => "uncaughtException" event => halting program.\n[${__filename}]`);
            return;
        }
        const sumanOpts = suman.opts, sumanConfig = suman.config;
        let delaySum = 0;
        if (test.stubbed) {
            rb.emit(String(suman_events_1.events.TEST_CASE_END), test);
            rb.emit(String(suman_events_1.events.TEST_CASE_STUBBED), test);
            return process.nextTick(cb, null);
        }
        if (test.skipped) {
            rb.emit(String(suman_events_1.events.TEST_CASE_END), test);
            rb.emit(String(suman_events_1.events.TEST_CASE_SKIPPED), test);
            return process.nextTick(cb, null);
        }
        const parallel = sumanOpts.parallel || (opts.parallel && !_suman.sumanOpts.series);
        async.eachSeries(getAllBeforesEaches(self), function (aBeforeEach, cb) {
            handleBeforeOrAfterEach(self, test, aBeforeEach, cb);
        }, function doneWithBeforeEaches(err) {
            general_1.implementationError(err);
            if (parallel) {
                delaySum += (test.delay || 0);
            }
            else {
                delaySum = 0;
            }
            async.series([
                function (cb) {
                    const handleTestContainer = function () {
                        handleTest(self, test, function (err, potentialTestError) {
                            general_1.implementationError(err);
                            handleTestError(potentialTestError, test);
                            suman.logResult(test);
                            cb(null);
                        });
                    };
                    if (delaySum) {
                        setTimeout(handleTestContainer, delaySum);
                    }
                    else {
                        handleTestContainer();
                    }
                },
                function (cb) {
                    async.eachSeries(getAllAfterEaches(self), function (aAfterEach, cb) {
                        handleBeforeOrAfterEach(self, test, aAfterEach, cb);
                    }, function done(err) {
                        general_1.implementationError(err);
                        process.nextTick(cb);
                    });
                }
            ], function doneWithTests(err, results) {
                err && _suman.log.error('Suman implementation error => the following error should not be present => ', err);
                cb(null, results);
            });
        });
    };
};
