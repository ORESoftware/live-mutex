'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const assert = require("assert");
const EE = require("events");
const async = require("async");
const suman_events_1 = require("suman-events");
const _suman = global.__suman = (global.__suman || {});
const general_1 = require("../helpers/general");
const suman_constants_1 = require("../config/suman-constants");
const make_the_trap_1 = require("./make-the-trap");
const rb = _suman.resultBroadcaster = (_suman.resultBroadcaster || new EE());
exports.makeStartSuite = function (suman, gracefulExit, handleBeforesAndAfters, notifyParentThatChildIsComplete) {
    return function startSuite(finished) {
        const self = this;
        const runTheTrap = make_the_trap_1.makeTheTrap(suman, gracefulExit);
        const sumanOpts = suman.opts, sumanConfig = suman.config;
        if (sumanOpts.series) {
            rb.emit(String(suman_events_1.events.SUMAN_CONTEXT_BLOCK), self);
        }
        if (suman.describeOnlyIsTriggered && !this.only) {
            this.skippedDueToOnly = this.skipped = true;
        }
        this.mergeBefores();
        this.mergeAfters();
        const q = suman.getQueue();
        let earlyCallback = Boolean(sumanOpts.parallel_max);
        q.push(function (queueCB) {
            async.series({
                runBeforeEachBlock: function (cb) {
                    async.eachSeries(self.getBeforeBlockList(), function (aBeforeOrAfter, cb) {
                        handleBeforesAndAfters(self, aBeforeOrAfter, cb);
                    }, function complete(err) {
                        general_1.implementationError(err);
                        process.nextTick(cb);
                    });
                },
                runBefores: function (cb) {
                    async.eachSeries(self.getBefores(), function (aBeforeOrAfter, cb) {
                        handleBeforesAndAfters(self, aBeforeOrAfter, cb);
                    }, function complete(err) {
                        general_1.implementationError(err);
                        process.nextTick(function () {
                            earlyCallback && finished();
                            cb();
                        });
                    });
                },
                runTests: function (cb) {
                    if (self.skipped || self.skippedDueToOnly) {
                        return process.nextTick(cb);
                    }
                    let fn1 = (self.parallel && !sumanOpts.series) ? async.parallel : async.series;
                    let limit = 1;
                    if (self.parallel && !sumanOpts.series) {
                        if (self.limit) {
                            limit = Math.min(self.limit, suman_constants_1.constants.DEFAULT_PARALLEL_TEST_LIMIT);
                        }
                        else {
                            limit = sumanConfig.DEFAULT_PARALLEL_TEST_LIMIT || suman_constants_1.constants.DEFAULT_PARALLEL_TEST_LIMIT;
                        }
                    }
                    const condition = Number.isInteger(limit) && limit > 0 && limit < 91;
                    assert(condition, 'limit must be an integer between 1 and 90, inclusive.');
                    fn1([
                        function runPotentiallySerialTests(cb) {
                            async.eachLimit(self.getTests(), limit, function (test, cb) {
                                const itOnlyIsTriggered = suman.itOnlyIsTriggered;
                                if (self.skipped) {
                                    test.skippedDueToParentSkipped = test.skipped = true;
                                }
                                if (self.skippedDueToOnly) {
                                    test.skippedDueToParentOnly = test.skipped = true;
                                }
                                if (itOnlyIsTriggered && !test.only) {
                                    test.skippedDueToItOnly = test.skipped = true;
                                }
                                runTheTrap(self, test, { parallel: false }, cb);
                            }, function complete(err) {
                                general_1.implementationError(err);
                                process.nextTick(cb);
                            });
                        },
                        function runParallelTests(cb) {
                            async.eachLimit(self.getParallelTests(), limit, function (test, cb) {
                                const itOnlyIsTriggered = suman.itOnlyIsTriggered;
                                if (self.skipped) {
                                    test.skippedDueToParentSkipped = test.skipped = true;
                                }
                                if (self.skippedDueToOnly) {
                                    test.skippedDueToParentOnly = test.skipped = true;
                                }
                                if (itOnlyIsTriggered && !test.only) {
                                    test.skippedDueToItOnly = test.skipped = true;
                                }
                                runTheTrap(self, test, { parallel: true }, cb);
                            }, function done(err) {
                                general_1.implementationError(err);
                                process.nextTick(cb, null);
                            });
                        }
                    ], function doneWithAllDescribeBlocks(err, results) {
                        general_1.implementationError(err);
                        process.nextTick(cb, null, results);
                    });
                },
                runAfters: function (cb) {
                    if (self.afterHooksCallback) {
                        return self.afterHooksCallback(cb);
                    }
                    if (!self.allChildBlocksCompleted && self.getChildren().length > 0) {
                        self.couldNotRunAfterHooksFirstPass = true;
                        return process.nextTick(cb);
                    }
                    self.alreadyStartedAfterHooks = true;
                    async.eachSeries(self.getAfters(), function (aBeforeOrAfter, cb) {
                        handleBeforesAndAfters(self, aBeforeOrAfter, cb);
                    }, function complete(err) {
                        general_1.implementationError(err);
                        notifyParentThatChildIsComplete(self, cb);
                    });
                },
                runAfterBlocks: function (cb) {
                    async.eachSeries(self.getAfterBlockList(), function (aBeforeOrAfter, cb) {
                        handleBeforesAndAfters(self, aBeforeOrAfter, cb);
                    }, function complete(err) {
                        general_1.implementationError(err);
                        process.nextTick(cb);
                    });
                }
            }, function allDone(err, results) {
                general_1.implementationError(err);
                self.isCompleted = true;
                process.nextTick(function () {
                    queueCB();
                    !earlyCallback && finished();
                });
            });
        });
    };
};
