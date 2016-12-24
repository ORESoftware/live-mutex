//core
const util = require('util');
const assert = require('assert');

//#project
const constants = require('../../config/suman-constants');
const cloneError = require('../clone-error');

///////////////////////////////////////////////////////////////

function missingHookOrTest () {
  const mzg = new Error(' => Suman implementation error, please report! ' +
    'Neither test nor hook defined, where at least one should be.');
  console.error(mzg.stack);
  global._writeTestError(mzg.stack);
  return mzg;
}

function planHelper (err, test, hook, assertCount) {

  const testOrHook = (test || hook);

  if (testOrHook.planCountExpected !== undefined) {
    assert(Number.isInteger(testOrHook.planCountExpected),
      ' => Suman usage error => "plan" option must be an integer.');
  }

  if (Number.isInteger(testOrHook.planCountExpected) && testOrHook.planCountExpected !== assertCount.num) {

    testOrHook.errorPlanCount = 'Error => Expected plan count was ' + testOrHook.planCountExpected +
      ' but actual assertion/confirm count was ' + assertCount.num;

    const newErr = cloneError(testOrHook.warningErr, testOrHook.errorPlanCount);

    if (err) {
      err = new Error(err.stack + '\n' + newErr.stack);
    }
    else {
      err = newErr;
    }
  }

  return err;

}

function throwsHelper (err, test, hook) {

  const testOrHook = (test || hook);

  if (testOrHook.throws !== undefined) {
    assert(testOrHook.throws instanceof RegExp,
      ' => Suman usage error => "throws" option must be a RegExp.');

    var z;
    if (!err) {

      z = testOrHook.didNotThrowErrorWithExpectedMessage =
        'Error => Expected to throw an error matching regex (' + testOrHook.throws + ') , but did not.';

      err = cloneError(testOrHook.warningErr, z);

      if (hook) {
        err.sumanFatal = true;
        err.sumanExitCode = constants.EXIT_CODES.HOOK_DID_NOT_THROW_EXPECTED_ERROR;
      }

    }
    else if (err && !String(err.stack || err).match(testOrHook.throws)) {

      z = testOrHook.didNotThrowErrorWithExpectedMessage =
        'Error => Expected to throw an error matching regex (' + testOrHook.throws + ') , but did not.';

      var newErr = cloneError(testOrHook.warningErr, z);

      err = new Error(err.stack + '\n' + newErr.stack);

    }
    else {
      // err matches expected error, so we can ignore error now
      err = null;
    }

  }

  return err;

}

//TODO: need to remove allowFatal due to --bail option
//TODO: this is used not just for tests but for hooks, so need to pass hook name if it exists

module.exports = function makeCallback (d, assertCount, test, hook, timerObj, gracefulExit, cb) {

  if (test && hook) {
    throw new Error(' => Suman internal implementation error => Please report this!');
  }
  else if (!test && !hook) {
    const $msg = new Error(' => Suman implementation error, please report! ' +
      'Neither test nor hook defined, where at least one should be.');
    console.error($msg.stack);
    global._writeTestError($msg.stack);
  }

  var called = 0;

  return function testAndHookCallbackHandler (err, isTimeout) {

    if (err) {

      if (String(err.stack || err).match(/Suman usage error/)) {
        err.sumanFatal = true;
        err.sumanExitCode = constants.EXIT_CODES.ASYCNCHRONOUS_REGISTRY_OF_TEST_BLOCK_METHODS;
        gracefulExit(err);
        return;
      }

      if (Array.isArray(err)) {
        err = new Error(err.map(e => (e.stack || (typeof e === 'string' ? e : util.inspect(e)))).join('\n\n'));
      }
      else {
        err = typeof err === 'object' ? err : new Error(typeof err === 'string' ? err : util.inspect(err));
      }

      //TODO: need to make timeout error distinguishable for hooks or test
      err.isTimeoutErr = isTimeout || false;
    }

    if (++called === 1) {

      try {
        if (test || hook) {
          err = planHelper(err, test, hook, assertCount);
          err = throwsHelper(err, test, hook);
        }
        else {
          throw missingHookOrTest();
        }

      }
      catch ($err) {
        err = $err;
      }

      if (testAndHookCallbackHandler.th) {
        testAndHookCallbackHandler.th.emit('done', err);
        testAndHookCallbackHandler.th.removeAllListeners();
      }
      else {
        throw new Error(' => Suman internal implementation error => Please report this!');
      }

      try {

        d.exit(); //TODO: this removed to allow for errors thrown *after* tests/hooks are called-back

        clearTimeout(timerObj.timer);

        if (err) {

          //TODO: can probably change check for type into simply a check for hook == null and test == null
          err.sumanFatal = err.sumanFatal || !!((hook && hook.fatal !== false) || global.sumanOpts.bail);

          if (test) {
            test.error = err;
          }

          if (global.sumanOpts.bail) {
            if (test) {
              err.sumanExitCode = constants.EXIT_CODES.TEST_ERROR_AND_BAIL_IS_TRUE;
            }
            else if (hook) {
              err.sumanExitCode = constants.EXIT_CODES.HOOK_ERROR_AND_BAIL_IS_TRUE;
            }
            else {
              throw missingHookOrTest();
            }
          }
        }
        else {
          if (test) {
            test.complete = true;
            test.dateComplete = Date.now();
          }
        }

      } catch ($err) {
        const $msg = '=> Suman internal implementation error, ' +
          'please report this => \n' + ($err.stack || $err);
        console.error($msg);
        global._writeTestError($msg);

      }
      finally {
        if (test) {
          cb(null, err);
        }
        else {
          gracefulExit(err, (test || hook), function () {
            cb(null, err);
          });
        }
      }
    }
    else {

      if (err) {
        global._writeTestError(err.stack || err);
      }

      // important note: the following logic says: the original callback should only be fired more than once if
      // it is due to a timeout firing *before* t.done/t.pass/t.fail etc.;
      // otherwise, we need to let the user know their code invoked the cb more than once using console.error
      // and possible fail the test, or add a warning

      if (called > 1 && test && !test.timedOut) {
        global._writeTestError('Warning: the following test callback was invoked twice by your code ' +
          'for the following test/hook => ' + (test ? test.desc : ''));
      }
      else if (called > 1 && hook) {  //TODO need to handle this case for hooks
        global._writeTestError('\n\nWarning: the following test callback was invoked twice by your code ' +
          'for the following hook => ' + (hook.desc || '(hook has no description)') + '\n\n');
      }

    }

  }

};