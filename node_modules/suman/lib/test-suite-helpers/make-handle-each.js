'use striiiiict';

//core
const domain = require('domain');
const assert = require('assert');

//npm
const _ = require('lodash');
const fnArgs = require('function-arguments');

//project
const sumanUtils = require('suman-utils/utils');
const constants = require('../../config/suman-constants');
const cloneError = require('../clone-error');
const makeHookObj = require('../t-proto-hook');
const makeCallback = require('./handle-callback-helper');
const helpers = require('./handle-promise-generator');
const freezeExistingProps = require('../freeze-existing');

//////////////////////////////////////////////////////////////////

module.exports = function (suman, gracefulExit) {

    return function handleBeforeOrAfterEach(self, test, aBeforeOrAfterEach, cb) {

        if (global.sumanUncaughtExceptionTriggered) {
            console.error(' => Suman runtime error => "UncaughtException:Triggered" => halting program.');
            return;
        }

        if (test.skipped || test.stubbed) {
            process.nextTick(cb);
        }
        else {

            const timerObj = {
                timer: setTimeout(onTimeout, global.weAreDebugging ? 5000000 : aBeforeOrAfterEach.timeout)
            };

            const assertCount = {
                num: 0
            };

            const d = domain.create();
            d._sumanEach = true;
            d._sumanEachDesc = aBeforeOrAfterEach.desc || '(unknown)';

            const fini = makeCallback(d, assertCount, null, aBeforeOrAfterEach, timerObj, gracefulExit, cb);

            function onTimeout() {
                const err = cloneError(aBeforeOrAfterEach.warningErr, constants.warnings.HOOK_TIMED_OUT_ERROR);
                err.sumanExitCode = constants.EXIT_CODES.HOOK_TIMED_OUT_ERROR;
                fini(err, true);
            }

            const fnStr = aBeforeOrAfterEach.fn.toString(); //TODO: need to check if it's a promise instead of a function if we go that route
            var dError = false;

            function handleError(err) {


                const stk = err.stack || err;
                const formatedStk = String(stk).split('\n').map(item => '\t' + item).join('\n');

                if (!dError) {
                    dError = true;
                    if (aBeforeOrAfterEach.fatal === false) {
                        const msg = ' => Suman non-fatal error => Error in hook and "fatal" option for the hook is set to false => \n' + formatedStk;
                        console.log('\n\n', msg, '\n\n');
                        global._writeTestError(msg);
                        fini(null);
                    }
                    else {
                        //note we want to exit right away, that's why this is commented out :)
                        err = new Error(' => fatal error in hook => (to continue even in the event of an error in a hook use option {fatal:false}) =>' + '\n\n' + formatedStk);
                        err.sumanFatal = true;
                        err.sumanExitCode = constants.EXIT_CODES.FATAL_HOOK_ERROR;
                        gracefulExit(err);  //always fatal error in beforeEach/afterEach
                    }
                }
                else {
                    global._writeTestError(' => Suman error => Error in hook => \n' + stk);
                }
            }

            d.on('error', handleError);

            d.run(function () {

                process.nextTick(function () {

                    var isAsyncAwait = false;

                    // const args = fnArgs(aBeforeOrAfterEach.fn);
                    const isGeneratorFn = sumanUtils.isGeneratorFn(aBeforeOrAfterEach.fn);

                    if (fnStr.indexOf('async') === 0) {
                        isAsyncAwait = true;
                    }

                    //TODO: need to implement all assert methods

                    function timeout(val) {
                        timerObj.timer = setTimeout(onTimeout, global.weAreDebugging ? 500000 : val);
                    }

                    function handleNonCallbackMode(err) {
                        err = err ? ('Also, you have this error => ' + err.stack || err) : '';
                        handleError(new Error('Callback mode for this test-case/hook is not enabled, use .cb to enabled it.\n' + err));
                    }

                    const HookObj = makeHookObj(aBeforeOrAfterEach, assertCount);
                    const t = new HookObj(handleError);
                    fini.th = t;
                    t.timeout = timeout;
                    t.data = test.data;
                    t.desc = t.title = test.desc;
                    t.value = test.value;
                    t.testId = test.testId;
                    t.state = 'passed';

                    t.fatal = function fatal(err) {
                        if (!t.callbackMode) {
                            return handleNonCallbackMode(err);
                        }
                        err = err || new Error('Temp error since user did not provide one.');
                        err.sumanFatal = true;
                        fini(err);
                    };


                    var args;

                    if (isGeneratorFn) {
                        if (aBeforeOrAfterEach.cb) {
                            throw new Error('Generator function callback also asking for done param => inconsistent.');
                        }

                        const handleGenerator = helpers.makeHandleGenerator(fini);
                        args = [freezeExistingProps(t)];
                        handleGenerator(aBeforeOrAfterEach.fn, args, aBeforeOrAfterEach.ctx);
                    }
                    else if (aBeforeOrAfterEach.cb) {

                        t.callbackMode = true;

                        const d = function done(err) {
                            console.log('D may be applied!');
                            if (!t.callbackMode) {
                                return handleNonCallbackMode(err);
                            }
                            if (err) {
                                err.sumanFatal = !!global.sumanOpts.bail;  //TODO: this is incorrect
                            }
                            fini(err);
                        };

                        // t.fail = t.fatal;  // t.fail doesn't make sense since this is not a test case, semantics...

                        t.done = function done(err) {
                            if (!t.callbackMode) {
                                return handleNonCallbackMode(err);
                            }
                            if (err) {
                                err.sumanFatal = !!global.sumanOpts.bail; //TODO: this is incorrect
                            }
                            fini(err);
                        };

                        t.ctn = function ctn() {        // t.pass doesn't make sense since this is not a test case
                            if (!t.callbackMode) {
                                return handleNonCallbackMode(err);
                            }
                            fini(null);
                        };

                        //if (!sumanUtils.checkForValInStr(aBeforeOrAfterEach.toString(), /done/g)) {
                        //    throw aBeforeOrAfterEach.NO_DONE;
                        //}

                        args = [Object.setPrototypeOf(d, freezeExistingProps(t))];

                        if (aBeforeOrAfterEach.fn.apply(aBeforeOrAfterEach.ctx, args)) { //TODO: apply(null) is correct?
                            global._writeTestError(cloneError(aBeforeOrAfterEach.warningErr, constants.warnings.RETURNED_VAL_DESPITE_CALLBACK_MODE, true).stack);
                        }

                    }
                    else {
                        const handlePotentialPromise = helpers.handlePotentialPromise(fini, fnStr);
                        args = [freezeExistingProps(t)];
                        handlePotentialPromise(aBeforeOrAfterEach.fn.apply(aBeforeOrAfterEach.ctx, args), false);
                    }

                });

            });

        }

    }

};
