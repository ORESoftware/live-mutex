'use strict';

//core
const util = require('util');

//npm
const colors = require('colors/safe');
const _ = require('lodash');

//project
const constants = require('../config/suman-constants');
const singleProc = process.env.SUMAN_SINGLE_PROCESS === 'yes';
const sumanUtils = require('suman-utils/utils');
const fatalRequestReply = require('./helpers/fatal-request-reply');
const debug = require('suman-debug')('s:graceful-exit');

/////////////////////////////////////////////////////////

const testErrors = global.testErrors = global.testErrors || [];
const sumanRuntimeErrors = global.sumanRuntimeErrors = global.sumanRuntimeErrors || [];

/////////////////////////////////////////////////////////

module.exports = function (suman) {

  return function makeGracefulExitOrNot(errs, hook, cb) {

    //TODO: may not need to pass hook in here anymore

    if (typeof cb !== 'function') {
      cb = function () {
        console.error(new Error(' => Callback fired, but callback was not passed to gracefulExit,' +
          'this is a implementation error => please report!'));
      };
    }

    var highestExitCode = 0;
    var exitTestSuite = false;

    errs = _.flattenDeep([errs]);

    if (global.sumanUncaughtExceptionTriggered) {
      console.error(' => Suman runtime error => "UncaughtException triggered" => halting program.');
      if (errs.length) {
        errs.filter(e => e).forEach(function (e) {
          console.error(' => Suman message => Most likely unrelated error => Graceful exit error => ' +
            (e.stack || e));
        });
      }
      return;   // do not continue, return here
    }

    const big = errs.filter(function (err) {

      if (err && err.isFromTest && !global.sumanOpts.bail) {
        return undefined;
      }
      else if (err && err.sumanFatal === false) {
        return undefined;
      }
      else if (err && err instanceof Error) {
        return err;
      }
      else if (err) {

        if (err.stack) {
          return err;
        }
        else {
          const temp = util.inspect(err);
          global._writeTestError('\n\n' + ' => Suman warning => non error passed => ' + temp);
          console.error('\n\n' + ' => Suman warning => non error passed => ' + temp);
          return new Error(temp);
        }
      }
      else {
        return undefined; //explicit for your pleasure
      }
    }).map(function (err) {

      var sumanFatal = err.sumanFatal;
      var exitCode = err.sumanExitCode;

      if (exitCode > highestExitCode) {
        highestExitCode = exitCode;
      }

      var stack = String(err.stack || err).split('\n');

      return stack.map(function (item, index) {

        if (index === 0) {
          // return '\t' + item;
          return item;
        }

        if (sumanFatal && index < 8) {
          return item;
        }

        if (item) {
          if (String(item).match(/at TestSuite/)) {   //TODO: should be TestSuiteBase now?
            return item;
          }
        }
      }).filter(item => item).join('\n').concat('\n');

    }).map(function (err) {

      exitTestSuite = true;
      sumanRuntimeErrors.push(err);

      debug(' => Graceful exit error message => ', err);

      const isBail = global.sumanOpts.bail ? '(--bail option set to true)' : '';
      const str = ' \u2691 ' +
        colors.bgRed.white.bold(' => Suman fatal error ' + isBail +
          ' => making a graceful exit => ') + '\n' + colors.red(err) + '\n\n';


      const s = str.split('\n').map(function (s) {
        return sumanUtils.padWithXSpaces(3) + s;
      }).join('\n');

      console.error(s);

      return s;

    });

    if (singleProc && exitTestSuite) {
      //TODO: need to handle fatal errors in suman single process
      console.error(' => Suman single process and runtime uncaught exception or error in hook experienced.');
      suman._sumanEvents.emit('suman-test-file-complete');
    }
    else if (exitTestSuite) {

      if (!suman.sumanCompleted) {
        // note: we need this check because on occasion errors occur in async code that don't get thrown
        // until after all boxes are checked in the system, we ignore the bad exit code in that case

        const joined = big.join('\n');
        fatalRequestReply({
          type: constants.runner_message_type.FATAL,
          data: {
            msg: joined,
            error: joined
          }
        }, function () {

          debug('JOINED','\n\n' + joined);

          suman.logFinished(highestExitCode || 1, null, function (err, val) {
            if (err) {
              console.error(new Error(err.stack || err));
            }
            global.suiteResultEmitter.emit('suman-completed', val);
          });

        });

      }
    }
    else {
      process.nextTick(cb);
    }
  }
};
