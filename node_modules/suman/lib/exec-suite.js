'use striiict';

//TODO: as we know which file or directory the user is running their tests, so error stack traces should only contain those paths
//note: http://stackoverflow.com/questions/20825157/using-spawn-function-with-node-env-production
//TODO: plugins http://hapijs.com/tutorials/plugins

//core
const domain = require('domain');
const path = require('path');
const assert = require('assert');
const EE = require('events');
const fs = require('fs');
const util = require('util');

//npm
const colors = require('colors/safe');
const async = require('async');
const _ = require('underscore');
const fnArgs = require('function-arguments');
const pragmatik = require('pragmatik');
const debug = require('suman-debug')('s:index');

//project
const rules = require('./helpers/handle-varargs');
const constants = require('../config/suman-constants');
const sumanUtils = require('suman-utils/utils');
const makeGracefulExit = require('./make-graceful-exit');
const originalAcquireDeps = require('./acquire-deps-original');
const makeAcquireDepsFillIn = require('./acquire-deps-fill-in');
const TestSuite = require('./TestSuite');
const fatalRequestReply = require('./helpers/fatal-request-reply');

////////////////////////////////////////////////////////////////////

module.exports = {

  main: function main(suman) {

    function onSumanCompleted(code, msg) {

      suman.sumanCompleted = true;

      if (process.env.SUMAN_SINGLE_PROCESS === 'yes') {
        suman._sumanEvents.emit('suman-test-file-complete');
      }
      else {

        suman.logFinished(code || 0, msg, function (err, val) {

          if (global.sumanOpts.checkMemoryUsage) {

            var m = {
              heapTotal: global.maxMem.heapTotal / 1000000,
              heapUsed: global.maxMem.heapUsed / 1000000
            };

            process.stderr.write(' => Maximum memory usage during run => ' + util.inspect(m));
          }

          global.suiteResultEmitter.emit('suman-completed', val);

        });

      }
    }

    const acquireDepsFillIn = makeAcquireDepsFillIn(suman);

    suman.dateSuiteStarted = Date.now();
    const allDescribeBlocks = suman.allDescribeBlocks;
    const gracefulExit = makeGracefulExit(suman);
    const Maker = TestSuite(suman, gracefulExit);

    function makeSuite(desc, opts, cb) {

      const _args = pragmatik.parse(arguments, rules.blockSignature);

      //TODO: when Node v4 is outdated we can move to array desctructuring
      desc = _args[0];
      opts = _args[1];
      cb = _args[2];
      suman.desc = desc;

      const allowArrowFn = global.sumanConfig.allowArrowFunctionsForTestSuites;
      const isArrow = sumanUtils.isArrowFunction(cb);
      const isGenerator = sumanUtils.isGeneratorFn(cb);
      const isAsync = sumanUtils.isAsyncFn(cb);

      debug(' => is arrow fn => ', isArrow);
      debug(' => allow arrow fn => ', allowArrowFn);

      if ((isArrow && !allowArrowFn) || isGenerator || isAsync) {

        const msg = constants.ERROR_MESSAGES.INVALID_FUNCTION_TYPE_USAGE;
        return fatalRequestReply({
          type: constants.runner_message_type.FATAL,
          data: {
            errors: [msg],
            msg: msg
          }
        }, function () {
          console.log(msg + '\n\n');
          console.error(new Error(' => Suman usage error => invalid arrow/generator function usage.').stack);
          return process.exit(constants.EXIT_CODES.INVALID_ARROW_FUNCTION_USAGE);
        });

      }

      const deps = suman.deps = fnArgs(cb);
      const delayOptionElected = opts.delay;

      //TODO: we need to warn the user when the give an option to describe or it that is not recognized
      //important line, don't remove LOL
      suman.rootSuiteDescription = desc;

      if (!opts.only && global.describeOnlyIsTriggered) {
        global._writeTestError(' => Suite with description => "' + desc + '" was skipped because another test suite in this file\n' +
          'invoked the only option.');
        onSumanCompleted(0, ' => skipped due to "only" option invoked on another test suite');
        return;
      }

      if (opts.skip) {
        global._writeTestError(' => Suite with description => "' + desc + '" was skipped because because you\n' +
          'passed the "skip" option to the test suite.');
        onSumanCompleted(0, ' => skipped due to explicit call of "skip" option');
        return;
      }

      var suite = Maker({
        desc: desc,
        isTopLevel: true,
        opts: opts
      });

      suite.__bindExtras();
      allDescribeBlocks.push(suite);

      try {
        //TODO: make this path reference the resolved paths in the resolved paths module
        const globalHooks = require(path.resolve(global.sumanHelperDirRoot + '/suman.hooks.js'));
        assert(typeof globalHooks === 'function', 'suman.hooks.js must export a function.');
        globalHooks.apply(suite, [suite]);
      }
      catch (err) {
        console.error('\n' + colors.magenta(' => Suman warning => Could not find the "suman.hooks.js" file in your <sumanHelpersDir>.\n' +
            'Create the file to remove the warning.'), '\n\n');
        if (global.sumanOpts.verbose) {
          console.error('\n', err.stack, '\n');
        }
      }

      if (deps.length < 1) {
        process.nextTick(function () {
          startWholeShebang([]);
        });
      }
      else {

        const d = domain.create();
        d._sumanStart = true;

        d.once('error', function (err) {

          d.exit();
          process.nextTick(function () {
            err = new Error(' => Suman usage error => Error acquiring IOC deps => \n' + (err.stack || err));
            err.sumanFatal = true;
            err.sumanExitCode = constants.EXIT_CODES.IOC_DEPS_ACQUISITION_ERROR;
            gracefulExit(err);
          });

        });

        d.run(function () {

          process.nextTick(function () {

            originalAcquireDeps(deps, function (err, deps) {

              if (err) {
                console.log(err.stack || err);
                process.exit(constants.EXIT_CODES.ERROR_ACQUIRING_IOC_DEPS);
              }
              else {

                acquireDepsFillIn(suite, deps, function (err, deps) {
                  if (err) {
                    throw err;
                  }
                  else {
                    d.exit();
                    process.nextTick(function () {
                      startWholeShebang(deps);
                    });

                  }
                });

              }
            });

          });

        });

      }

      //TODO: http://stackoverflow.com/questions/27192917/using-a-domain-to-test-for-an-error-thrown-deep-in-the-call-stack-in-node

      function startWholeShebang(deps) {

        const d = domain.create();
        d._sumanStartWholeShebang = true;

        d.once('error', function (err) {

          d.exit();
          process.nextTick(function () {
            err.sumanFatal = true;
            err.sumanExitCode = constants.EXIT_CODES.ERROR_IN_ROOT_SUITE_BLOCK;
            gracefulExit(err);
          });

        });

        d.run(function () {

            process.nextTick(function () {

              suite.fatal = function (err) {
                err = err || new Error('Fatal error experienced in root suite.');
                console.log(err.stack);
                err.sumanExitCode = constants.EXIT_CODES.ERROR_PASSED_AS_FIRST_ARG_TO_DELAY_FUNCTION;
                gracefulExit(err);
              };

              if (delayOptionElected) {

                suite.__proto__.isDelayed = true;

                const to = setTimeout(function () {
                  console.log('\n\n => Suman fatal error => suite.resume() function was not called within alloted time.');
                  process.exit(constants.EXIT_CODES.DELAY_FUNCTION_TIMED_OUT);
                }, global.weAreDebugging ? 500000 : 11000);

                if (global.sumanOpts.verbose) {
                  console.log(' => Waiting for delay() function to be called...');
                }

                var callable = true;

                suite.__proto__.__resume = function (val) {

                  debugger;

                  if (callable) {
                    callable = false;
                    clearTimeout(to);
                    process.nextTick(function () {
                      suite.__proto__.isSetupComplete = true; // keep this, needs be called asynchronously
                      suite.__invokeChildren(val, start); //pass start function all the way through program until last child delay call is invoked!
                    });
                  }
                  else {
                    console.error('\n', ' => Suman usage warning => suite.resume() was called more than once.');
                  }
                };

                const str = cb.toString();

                if (!sumanUtils.checkForValInStr(str, /resume/g, 0)) { //TODO this will not work when delay is simply commented out
                  process.nextTick(function () {
                    console.error(new Error(' => Suman usage error => suite.resume() method needs to be called to continue,' +
                        ' but the resume method was never referenced, so your test cases would never be invoked before timing out.').stack
                      + '\n =>' + str);
                    process.exit(constants.EXIT_CODES.DELAY_NOT_REFERENCED);
                  });
                }
                else {
                  cb.apply(suite, deps);
                }
              }
              else {

                suite.__proto__.__resume = function () {
                  console.error('\n', ' => Suman usage warning => suite.resume() has become a noop since delay option is falsy.');
                };

                cb.apply(suite, deps);
                suite.__proto__.isSetupComplete = true;
                process.nextTick(function () {
                  suite.__invokeChildren(null, start); //pass start function all the way through program until last child delay call is invoked!
                });
              }
            });

          }
        );

      }

      function start() {

        // const timeoutVal = global.weAreDebugging ? 50000000 : (global.sumanConfig.defaultTestSuiteTimeout || 100000);

        // const timeoutVal = 50000000;
        //
        // const to = setTimeout(function () {
        //   //note: this timer is necessary so that a test suite will timeout and allow blocked processes to run
        //   console.error('\n\n', colors.red(' => Suman fatal error => Suite timed out after ' + timeoutVal + ' seconds.'));
        //   process.exit(constants.EXIT_CODES.SUITE_TIMEOUT);
        // }, timeoutVal);

        // var count = 0;
        //
        // ee.on('test_complete', function handleCompleteTest() {
        //     count++;
        // });

        function runSuite(suite, cb) {

          if (global.sumanUncaughtExceptionTriggered) {
            console.error(' => Suman runtime error => "UncaughtException:Triggered" => halting program.');
            return;
          }

          const fn = suite.parallel ? async.each : async.eachSeries;

          suite.__startSuite(function (err, results) {

            if (err) {
              console.error('test error data before log:', suite);
            }

            // ee.emit('test_complete', suite);
            suman.logData(suite);

            //TODO: this might be wrong, may need to omit filter
            const children = suite.getChildren().filter(function (child) {
              return !child.skipped;
            });

            if (children.length < 1) {
              process.nextTick(cb)
            }
            else {
              fn(children, function (child, cb) {

                child = _.findWhere(allDescribeBlocks, {
                  testId: child.testId
                });

                runSuite(child, cb);

              }, function (err, results) {
                process.nextTick(cb);
              });
            }
          });
        }

        runSuite(allDescribeBlocks[0], function complete() {

          suman.dateSuiteFinished = Date.now();
          // clearTimeout(to);

          if (global.sumanUncaughtExceptionTriggered) {
            console.error(' => Suman runtime error => "UncaughtException:Triggered" => halting program.');
            return;
          }

          onSumanCompleted(0);

        });

      }
    }

    return makeSuite;
  }
};
