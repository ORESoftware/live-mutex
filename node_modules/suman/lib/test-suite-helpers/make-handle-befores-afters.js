'use striiiict';

//core
const domain = require('domain');
const assert = require('assert');

//npm
const _ = require('lodash');

//project
const sumanUtils = require('suman-utils/utils');
const fnArgs = require('function-arguments');
const debug_core = require('debug')('suman:core');
const debugSumanTest = require('debug')('suman:test');
const makeCallback = require('./handle-callback-helper');
const helpers = require('./handle-promise-generator');
const constants = require('../../config/suman-constants');
const cloneError = require('../clone-error');
const makeHookObj = require('../t-proto-hook');
const freezeExistingProps = require('../freeze-existing');

/////////////////////////////////////////////////////////////////////////////////////

module.exports = function (suman, gracefulExit) {

    return function handleBeforesAndAfters(aBeforeOrAfter, cb) {

        if (global.sumanUncaughtExceptionTriggered) {
            console.error(' => Suman runtime error => "UncaughtException:Triggered" => halting program.');
            return;
        }

        const timerObj = {
            timer: setTimeout(onTimeout, global.weAreDebugging ? 5000000 : aBeforeOrAfter.timeout)
        };

        const assertCount = {
            num: 0
        };

        const d = domain.create();
        d._sumanBeforeAfter = true;
        d._sumanBeforeAfterDesc = aBeforeOrAfter.desc || '(unknown)';

        const fini = makeCallback(d, assertCount, null, aBeforeOrAfter, timerObj, gracefulExit, cb);
        const fnStr = aBeforeOrAfter.fn.toString();

        function onTimeout() {
            fini(cloneError(aBeforeOrAfter.warningErr, constants.warnings.HOOK_TIMED_OUT_ERROR), true);
        }

        //TODO: need to add more info to logging statement below and also handle if fatal:false
        var dError = false;

        function handleError(err) {

            const stk = err.stack || err;
            const formatedStk = String(stk).split('\n').map(item => '\t' + item).join('\n');

            if (!dError) {
                dError = true;
                if (aBeforeOrAfter.fatal === false) {
                    const msg = ' => Suman non-fatal error => Error in hook and "fatal" option for the hook is set to false => \n' + formatedStk;
                    console.log('\n\n\t', msg, '\n\n');
                    global._writeTestError(msg);
                    fini(null);
                }
                else {
                    err = new Error('=> fatal error in hook => (to continue even in the event of an error in a hook use option {fatal:false}) => ' + '\n\n' + formatedStk);
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

                var warn = false;

                if (fnStr.indexOf('Promise') > 0 || fnStr.indexOf('async') === 0) {
                    warn = true;
                }

                const isGeneratorFn = sumanUtils.isGeneratorFn(aBeforeOrAfter.fn);

                function timeout(val) {
                    timerObj.timer = setTimeout(onTimeout, global.weAreDebugging ? 500000 : val);
                }

                function handleNonCallbackMode(err) {
                    err = err ? ('Also, you have this error => ' + err.stack || err) : '';
                    handleError(new Error('Callback mode for this test-case/hook is not enabled, use .cb to enabled it.\n' + err));
                }

                const HookObj = makeHookObj(aBeforeOrAfter, assertCount);
                const t = new HookObj(handleError);

                fini.th = t;
                t.timeout = timeout;

                t.fatal = function fatal(err) {
                    err = err || new Error('Suman placeholder error since this function was not explicitly passed an error object as first argument.');
                    fini(err);
                };

                var args;

                if (isGeneratorFn) {

                    if (aBeforeOrAfter.cb) {
                        throw new Error('Generator function callback also asking for done param => inconsistent.');
                    }
                    const handleGenerator = helpers.makeHandleGenerator(fini);
                    args = [freezeExistingProps(t)];
                    handleGenerator(aBeforeOrAfter.fn, args, aBeforeOrAfter.ctx);
                }
                else if (aBeforeOrAfter.cb) {

                    t.callbackMode = true;

                    //if (!sumanUtils.checkForValInStr(aBeforeOrAfter.toString(), /done/g)) {
                    //    throw aBeforeOrAfter.NO_DONE;
                    //}

                    const d = function done(err) {
                        if (!t.callbackMode) {
                            handleNonCallbackMode(err);
                        }
                        else {
                            fini(err);
                        }
                    };

                    t.done = function done(err) {
                        if (!t.callbackMode) {
                            handleNonCallbackMode(err);
                        }
                        else {
                            fini(err);
                        }
                    };

                    t.ctn = function ctn(err) {
                        if (!t.callbackMode) {
                            handleNonCallbackMode(err);
                        }
                        else {
                            fini(null);
                        }

                    };


                    args = [Object.setPrototypeOf(d, freezeExistingProps(t))];

                    if (aBeforeOrAfter.fn.apply(aBeforeOrAfter.ctx, args)) {  //check to see if we have a defined return value
                        global._writeTestError(cloneError(aBeforeOrAfter.warningErr, constants.warnings.RETURNED_VAL_DESPITE_CALLBACK_MODE, true).stack);
                    }

                }
                else {
                    const handlePotentialPromise = helpers.handlePotentialPromise(fini, fnStr);
                    args = [freezeExistingProps(t)];
                    handlePotentialPromise(aBeforeOrAfter.fn.apply(aBeforeOrAfter.ctx, args), warn);

                }

            });

        });
    }
};
