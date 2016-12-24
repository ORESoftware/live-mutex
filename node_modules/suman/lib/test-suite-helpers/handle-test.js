//#core
const domain = require('domain');
const assert = require('assert');

//#npm
const fnArgs = require('function-arguments');
const _ = require('lodash');

//#project
const constants = require('../../config/suman-constants');
const sumanUtils = require('suman-utils/utils');
const makeCallback = require('./handle-callback-helper');
const helpers = require('./handle-promise-generator');
const cloneError = require('../clone-error');
const makeTestCase = require('../t-proto-test');
const freezeExistingProps = require('../freeze-existing');


//note: we had an outer closure, but removed it, see git history
module.exports = function (suman, gracefulExit) {

    return function handleTest(self, test, cb) {

        if (global.sumanUncaughtExceptionTriggered) {
            console.error(' => Suman runtime error => "UncaughtException:Triggered" => halting program.');
            return;
        }

        if (test.stubbed || test.skipped) {
            process.nextTick(cb);
        }
        else {

            const timerObj = {
                timer: setTimeout(onTimeout, global.weAreDebugging ? 5000000 : test.timeout)
            };

            const d = domain.create();
            d._sumanTest = true;
            d._sumanTestName = test.desc;

            const assertCount = {
                num: 0
            };

            const fnStr = test.fn.toString();
            const fini = makeCallback(d, assertCount, test, null, timerObj, gracefulExit, cb);

            function onTimeout() {
                test.timedOut = true;
                const err = cloneError(test.warningErr, constants.warnings.TEST_CASE_TIMED_OUT_ERROR);
                err.isFromTest = true;
                fini(err, true);
            }

            var derror = false;

            function handleError(err) {

                const stk = err.stack || err;

                if (!derror) {
                    derror = true;
                    clearTimeout(timerObj.timer);
                    //note: we need to call done in same tick instead of in nextTick otherwise it can be called by another location
                    fini(err);
                }
                else {
                    global._writeTestError(' => Suman error => Error in hook => \n' + stk);
                }
            }

            d.on('error', handleError);

            d.run(function () {

                process.nextTick(function () {

                    var warn = false;
                    var isAsyncAwait = false;

                    if (fnStr.indexOf('Promise') > 0 || fnStr.indexOf('async') === 0) {  //TODO: this check needs to get updated, async functions should return promises implicitly
                        warn = true;
                    }

                    const isGeneratorFn = sumanUtils.isGeneratorFn(test.fn);

                    function timeout(val) {
                        timerObj.timer = setTimeout(onTimeout, global.weAreDebugging ? 500000 : val);
                    }

                    function $throw(str) {
                        handleError(str instanceof Error ? str : new Error(str));
                    }

                    function slow() {
                        //TODO
                    }

                    function handle(fn) {
                        try {
                            fn.apply(self, []);
                        }
                        catch (e) {
                            handleError(e);
                        }
                    }

                    function handleNonCallbackMode(err) {
                        err = err ? ('Also, you have this error => ' + err.stack || err) : '';
                        handleError(new Error('Callback mode for this test-case/hook is not enabled, use .cb to enabled it.\n' + err));
                    }

                    const TestCase = makeTestCase(test, assertCount);
                    const t = new TestCase(handleError);

                    fini.th = t;
                    t.handleAssertions = handle;
                    t.throw = $throw;
                    t.timeout = timeout;

                    ////////////// note: unfortunately these fns cannot be moved to prototype /////////////////////////

                    t.fatal = function fatal(err) {
                        if (!t.callbackMode) {
                            handleNonCallbackMode(err);
                        }
                        else {
                            err = err || new Error('t.fatal() was called by the developer.');
                            err.sumanFatal = true;
                            fini(err);
                        }
                    };

                    ////////////////////////////////////////////////////////////////////////////////////////////

                    test.dateStarted = Date.now();

                    var args;

                    if (isGeneratorFn) {
                        const handleGenerator = helpers.makeHandleGenerator(fini);
                        if (test.cb === true) {
                            throw new Error('Generator function callback is also asking for callback mode => inconsistent.');
                        }
                        args = [freezeExistingProps(t)];
                        handleGenerator(test.fn, args, self);
                    }
                    else if (test.cb === true) {

                        t.callbackMode = true;

                        //if (!sumanUtils.checkForValInStr(test.fn.toString(), /done/g)) {
                        //    throw test.fn.NO_DONE;
                        //}

                        const d = function done(err) {
                            if (!t.callbackMode) {
                                handleNonCallbackMode(err);
                            }
                            else {
                                fini(err);
                            }
                        };

                        fini.th = d;


                        t.done = function done(err) {
                            if (!t.callbackMode) {
                                handleNonCallbackMode(err);
                            }
                            else {
                                fini(err);
                            }
                        };

                        t.pass = function pass() {
                            if (!t.callbackMode) {
                                handleNonCallbackMode();
                            }
                            else {
                                fini(null);   //TODO: use spread operator here
                            }

                        };

                        t.fail = function fail(err) {
                            if (!t.callbackMode) {
                                handleNonCallbackMode();
                            }
                            else {
                                fini(err || new Error('t.fail() was called on test (note that null/undefined value ' +
                                        'was passed as first arg to the fail function.)'));
                            }
                        };

                        args = [Object.setPrototypeOf(d, freezeExistingProps(t))];
                        if (test.fn.apply(self, args)) {  ///run the fn, but if it returns something, then add warning
                            global._writeTestError(cloneError(test.warningErr, constants.warnings.RETURNED_VAL_DESPITE_CALLBACK_MODE, true).stack);
                        }

                    }
                    else {
                        const handlePotentialPromise = helpers.handlePotentialPromise(fini, fnStr);
                        args = [freezeExistingProps(t)];
                        handlePotentialPromise(test.fn.apply(self, args), warn);
                    }

                });

            });

        }
    }
};