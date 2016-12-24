'use strict';  // important note: so errors get thrown if properties are modified after the fact

//TODO: create immutable props - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty

//core
const domain = require('domain');
const util = require('util');
const assert = require('assert');

//npm
const fnArgs = require('function-arguments');
const pragmatik = require('pragmatik');
const _ = require('underscore');
const async = require('async');
const colors = require('colors/safe');

//project
const rules = require('./helpers/handle-varargs');
const implementationError = require('./helpers/implementation-error');
const constants = require('../config/suman-constants');
const incr = require('./incrementer');
const sumanUtils = require('suman-utils/utils');
const freezeExistingProps = require('./freeze-existing');
const originalAcquireDeps = require('./acquire-deps-original');
const makeAcquireDepsFillIn = require('./acquire-deps-fill-in');
const startSuite = require('./test-suite-helpers/start-suite');

///////////////////////////////////////////////////////////////////////

function handleSetupComplete(test) {
  if (test.isSetupComplete) {
    console.error('\n', colors.red.bold(' => Suman usage error => fatal => Asynchronous registry of test suite methods. Fatal AF.'), '\n\n');
    const e = new Error('Suman usage error => Fatal error => You have attempted to register calls to a\n' +
      'test suite block that has already finished registering hooks, test cases and child blocks.\n' +
      'To be more exact, one of two things happened: Either (1) ' +
      'You referenced a parent suite block inside a\nchild suite block by accident, or more likely (2) you called registry' +
      ' functions asynchronously.\n' +
      '\nYou cannot call the following functions asynchronously - describe(), it(), ' +
      'before(), beforeEach(), after(), afterEach()\n- do not ' +
      'put these calls inside a setTimeout, setImmediate, process.nextTick or any other asynchronous calls.\n' +
      ' *** !! This includes nesting these calls inside each other. !! ***\n\t' +
      '\nThis is a fatal error because behavior will be completely indeterminate upon asynchronous ' +
      'registry of these calls.');
    global.sumanRuntimeErrors.push(e);
    e.sumanFatal = true;
    throw e;
  }
}

function handleBadOptionsForEachHook(hook, opts) {

  if (opts.plan !== undefined && !Number.isInteger(opts.plan)) {
    console.error(' => Suman usage error => "plan" option is not an integer.');
    return process.exit(constants.EXIT_CODES.OPTS_PLAN_NOT_AN_INTEGER);
  }

}

function handleBadOptionsForAllHook(hook, opts) {

  if (opts.plan !== undefined && !Number.isInteger(opts.plan)) {
    console.error(' => Suman usage error => "plan" option is not an integer.');
    return process.exit(constants.EXIT_CODES.OPTS_PLAN_NOT_AN_INTEGER);
  }
}

function makeRunChild(val) {
  return function runChild(child, cb) {
    child._run(val, cb);
  }
}

function makeTestSuiteMaker(suman, gracefulExit) {


  const acquireDepsFillIn = makeAcquireDepsFillIn(suman);
  const allDescribeBlocks = suman.allDescribeBlocks;
  const _interface = String(suman.interface).toUpperCase() === 'TDD' ? 'TDD' : 'BDD';

  function TestSuiteBase(obj) {

    this.opts = obj.opts;
    this.testId = incr();
    this.isSetupComplete = false;
    this.parallel = !!(obj.opts.parallel === true || obj.opts.mode === 'parallel');
    this.skipped = this.opts.skip || false;
    this.only = this.opts.only || false;

    const children = [];
    const tests = [];
    const parallelTests = [];
    const testsParallel = [];
    const loopTests = [];
    const befores = [];
    const beforeEaches = [];
    const afters = [];
    const afterEaches = [];

    this.getChildren = function () {
      return children;
    };

    this.getTests = function () {
      return tests;
    };

    this.getParallelTests = function () {
      return parallelTests;
    };

    this.getTestsParallel = function () {
      return testsParallel;
    };

    this.getLoopTests = function () {
      return loopTests;
    };

    this.getBefores = function () {
      return befores;
    };

    this.getBeforeEaches = function () {
      return beforeEaches;
    };

    this.getAfters = function () {
      return afters;
    };

    this.getAfterEaches = function () {
      return afterEaches;
    };
  }

  //TODO: need to validate raw data...
  const TestSuiteMaker = function _TestSuiteMaker(data) {

    var it, describe, before, after, beforeEach, afterEach;

    function TestSuite(obj) {

      this.interface = suman.interface;
      this.desc = this.title = obj.desc; //TODO: can grab name from function

      this.timeout = function () {
        console.error('not implemented yet.');
      };

      this.slow = function () {
        console.error('not implemented yet.');
      };

      const _zuite = this;
      this.resume = function () {
        const args = Array.prototype.slice.call(arguments);
        debugger;
        process.nextTick(function () {
          _zuite.__resume.apply(_zuite, args);
        });
      };

      const zuite = this;

      before = function (desc, opts, fn) {

        handleSetupComplete(zuite);

        const _args = pragmatik.parse(arguments, rules.hookSignature, {
          preParsed: typeof opts === 'object' ? opts.__preParsed : null
        });

        const obj = {
          desc: _args[0],
          opts: _args[1],
          fn: _args[2]
        };

        handleBadOptionsForAllHook(obj.opts, zuite);

        if (obj.opts.skip) {
          suman.numHooksSkipped++;
        }
        else if (!obj.fn) {
          suman.numHooksStubbed++;
        }
        else {
          zuite.getBefores().push({  //TODO: add timeout option
            ctx: zuite,
            desc: obj.desc || obj.fn ? obj.fn.name : '(unknown due to stubbed function)',
            timeout: obj.opts.timeout || 11000,
            cb: obj.opts.cb || false,
            throws: obj.opts.throws,
            planCountExpected: obj.opts.plan,
            fatal: !(obj.opts.fatal === false),
            fn: obj.fn,
            timeOutError: new Error('*timed out* - did you forget to call done/ctn/fatal()?'),
            type: 'before/setup',
            warningErr: new Error('SUMAN_TEMP_WARNING_ERROR')
          });
        }

        return zuite;

      };

      _interface === 'TDD' ? this.setup = before : this.before = before;

      after = function (desc, opts, fn) {

        handleSetupComplete(zuite);

        const _args = pragmatik.parse(arguments, rules.hookSignature, {
          preParsed: typeof opts === 'object' ? opts.__preParsed : null
        });

        const obj = {
          desc: _args[0],
          opts: _args[1],
          fn: _args[2]
        };

        handleBadOptionsForAllHook(obj.opts, zuite);

        if (obj.opts.skip) {
          suman.numHooksSkipped++;
        }
        else if (!obj.fn) {
          suman.numHooksStubbed++;
        }
        else {
          zuite.getAfters().push({   //TODO: add timeout option
            ctx: zuite,
            timeout: obj.opts.timeout || 11000,
            desc: obj.desc || obj.fn ? obj.fn.name : '(unknown due to stubbed function)',
            cb: obj.opts.cb || false,
            throws: obj.opts.throws,
            planCountExpected: obj.opts.plan,
            fatal: !(obj.opts.fatal === false),
            fn: obj.fn,
            type: 'after/teardown',
            warningErr: new Error('SUMAN_TEMP_WARNING_ERROR')
          });
        }

        return zuite;

      };

      _interface === 'TDD' ? this.teardown = after : this.after = after;

      beforeEach = function (desc, opts, aBeforeEach) {

        handleSetupComplete(zuite);

        const _args = pragmatik.parse(arguments, rules.hookSignature, {
          preParsed: typeof opts === 'object' ? opts.__preParsed : null
        });

        const obj = {
          desc: _args[0],
          opts: _args[1],
          fn: _args[2]
        };

        handleBadOptionsForEachHook(obj.opts, zuite);

        if (obj.opts.skip) {
          suman.numHooksSkipped++;
        }
        else if (!obj.fn) {
          suman.numHooksStubbed++;
        }
        else {
          zuite.getBeforeEaches().push({  //TODO: add timeout option
            ctx: zuite,
            timeout: obj.opts.timeout || 11000,
            desc: obj.desc || obj.fn ? obj.fn.name : '(unknown due to stubbed function)',
            fn: obj.fn,
            throws: obj.opts.throws,
            planCountExpected: obj.opts.plan,
            fatal: !(obj.opts.fatal === false),
            cb: obj.opts.cb || false,
            type: 'beforeEach/setupTest',
            warningErr: new Error('SUMAN_TEMP_WARNING_ERROR')
          });
        }

        return zuite;

      };

      _interface === 'TDD' ? this.setupTest = beforeEach : this.beforeEach = beforeEach;

      afterEach = function (desc, opts, aAfterEach) {

        handleSetupComplete(zuite);

        const _args = pragmatik.parse(arguments, rules.hookSignature, {
          preParsed: typeof opts === 'object' ? opts.__preParsed : null
        });

        //TODO: when Node v4 is outdated we can move to array desctructuring
        const obj = {
          desc: _args[0],
          opts: _args[1],
          fn: _args[2]
        };

        handleBadOptionsForEachHook(obj.opts, zuite);

        if (obj.opts.skip) {
          suman.numHooksSkipped++;
        }
        else if (!obj.fn) {
          suman.numHooksStubbed++;
        }
        else {
          zuite.getAfterEaches().push({
            ctx: zuite,
            timeout: obj.opts.timeout || 11000,
            desc: obj.desc || obj.fn ? obj.fn.name : '(unknown due to stubbed function)',
            cb: obj.opts.cb || false,
            throws: obj.opts.throws,
            planCountExpected: obj.opts.plan,
            fatal: !(obj.opts.fatal === false),
            fn: obj.fn,
            type: 'afterEach/teardownTest',
            warningErr: new Error('SUMAN_TEMP_WARNING_ERROR')
          });
        }
        return zuite;

      };

      _interface === 'TDD' ? this.teardownTest = afterEach : this.afterEach = afterEach;

      it = function (desc, opts, fn) {

        handleSetupComplete(zuite);

        const _args = pragmatik.parse(arguments, rules.testCaseSignature, {
          preParsed: typeof opts === 'object' ? opts.__preParsed : null
        });

        //TODO: when Node v4 is outdated we can move to array desctructuring
        desc = _args[0];
        opts = _args[1];
        fn = _args[2];

        var testData = null;
        var stubbed = false;

        if (!fn) {
          stubbed = true;
        }

        if (opts.skip) {
          testData = {testId: incr(), desc: desc, skipped: true, stubbed: stubbed};
          zuite.getTests().push(testData);
          return zuite;
        }

        if (suman.itOnlyIsTriggered && !opts.only) {
          //TODO: fix this
          testData = {testId: incr(), desc: desc, skipped: true, skippedDueToItOnly: true, stubbed: stubbed};
          zuite.getTests().push(testData);
          return zuite;
        }

        if (opts.plan !== undefined && !Number.isInteger(opts.plan)) {
          console.error(' => Suman usage error => "plan" option is not an integer.');
          return process.exit(constants.EXIT_CODES.OPTS_PLAN_NOT_AN_INTEGER);
        }

        if (opts.hasOwnProperty('parallel')) {
          if (opts.hasOwnProperty('mode')) {
            console.log(' => Suman warning => Used both parallel and mode options => mode will take precedence.');
            if (opts.mode !== 'parallel' && opts.mode !== 'series') {
              console.log(' => Suman warning => valid "môde" options are only values of "parallel" or "series".');
            }
          }
        }

        //TODO: need to fix, because user could overwrite API data
        testData = {
          testId: incr(),
          stubbed: stubbed,
          data: {},
          planCountExpected: opts.plan,
          originalOpts: opts,
          only: opts.only,
          skip: opts.skip,
          value: opts.value,
          throws: opts.throws,
          parallel: (opts.parallel === true || opts.mode === 'parallel'),
          mode: opts.mode,
          delay: opts.delay,
          cb: opts.cb,
          type: 'it-standard',
          timeout: opts.timeout || 20000,
          desc: desc,
          fn: fn,
          warningErr: new Error('SUMAN_TEMP_WARNING_ERROR'),
          timedOut: false,
          complete: false,
          error: null
        };

        if (opts.parallel || (zuite.parallel && opts.parallel !== false)) {
          zuite.getParallelTests().push(testData);
        }
        else {
          zuite.getTests().push(testData);
        }

        return zuite;

      };

      _interface === 'TDD' ? this.test = it : this.it = it;

      describe = this.context = function (desc, opts, cb) {

        handleSetupComplete(zuite);
        const _args = pragmatik.parse(arguments, rules.blockSignature, {
          preParsed: typeof opts === 'object' ? opts.__preParsed : null
        });

        desc = _args[0];
        opts = _args[1];
        cb = _args[2];

        const allowArrowFn = global.sumanConfig.allowArrowFunctionsForTestSuites;
        const isArrow = sumanUtils.isArrowFunction(cb);
        const isGenerator = sumanUtils.isGeneratorFn(cb);
        const isAsync = sumanUtils.isAsyncFn(cb);


        if ((isArrow && !allowArrowFn) || isGenerator || isAsync) { //TODO: need to check for generators or async/await as well
          const msg = constants.ERROR_MESSAGES.INVALID_FUNCTION_TYPE_USAGE;
          console.log('\n\n' + msg + '\n\n');
          console.error(new Error(' => Suman usage error => invalid arrow/generator function usage.').stack);
          return process.exit(constants.EXIT_CODES.INVALID_ARROW_FUNCTION_USAGE);
        }

        if (zuite.parallel && opts.parallel === false) {
          process.stdout.write('\n => Suman warning => parent block ("' + zuite.desc + '") is parallel, so child block ("' + desc + '") will be run in parallel with other sibling blocks.');
          process.stdout.write('\n => Suman warning => To see more info on this, visit: oresoftware.github.io/suman\n\n');
        }

        if (zuite.skipped) {
          console.error(' => Implementation warning => Child suite entered when parent was skipped.');
        }

        if (opts.skip || zuite.skipped || (!opts.only && suman.describeOnlyIsTriggered)) {
          suman.numBlocksSkipped++;
          return;
        }

        const parent = zuite;
        const suite = TestSuiteMaker({
          desc: desc,
          title: desc,
          opts: opts
        });

        suite.skipped = opts.skip || zuite.skipped;

        if (!suite.only && suman.describeOnlyIsTriggered) {
          suite.skipped = suite.skippedDueToDescribeOnly = true;
        }

        suite.parent = _.pick(zuite, 'testId', 'desc', 'title', 'parallel');

        zuite.getChildren().push({testId: suite.testId});
        allDescribeBlocks.push(suite);

        const deps = fnArgs(cb);

        suite.__proto__._run = function run(val, callback) {

          debugger;

          if (zuite.skipped || zuite.skippedDueToDescribeOnly) {
            //TODO: have to notify parent that child is done?
            return process.nextTick(callback);
          }

          const d = domain.create();

          d.once('error', function (err) {
            if (global.weAreDebugging) {
              console.error(err.stack || err);
            }
            console.log(' => Error executing test block => ', err.stack);
            err.sumanExitCode = constants.EXIT_CODES.ERROR_IN_CHILD_SUITE;
            gracefulExit(err);
          });

          d.run(function () {

            // note: *very important* => each describe block needs to be invoked in series, one by one,
            // so that we bind skip and only to the right suite

            suite.getResumeValue = function () {
              debugger;
              return val;
            };

            suite.__bindExtras();

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

                    suite.fatal = function (err) {
                      err = err || new Error(' => suite.fatal() was called by the developer => fatal unspecified error.');
                      console.log(err.stack || err);
                      err.sumanExitCode = constants.EXIT_CODES.ERROR_PASSED_AS_FIRST_ARG_TO_DELAY_FUNCTION;
                      gracefulExit(err);
                    };

                    const delayOptionElected = !!opts.delay;

                    if (!delayOptionElected) {

                      suite.__proto__.__resume = function () {
                        console.error('\n', ' => Suman usage warning => suite.resume() has become a noop since delay option is falsy.');
                      };

                      cb.apply(suite, deps);
                      d.exit();
                      suite.__proto__.isSetupComplete = true;
                      process.nextTick(function () {
                        parent.__bindExtras();  //bind extras back to parent test
                        suite.__invokeChildren(null, callback);
                      });
                    }

                    else {
                      suite.__proto__.isDelayed = true;

                      const str = cb.toString();
                      //TODO this will not work when delay is simply commented out

                      if (!sumanUtils.checkForValInStr(str, /resume/g, 0)) {
                        process.nextTick(function () {
                          console.error(new Error(' => Suman usage error => delay option was elected, so suite.resume() method needs to be called to continue,' +
                            ' but the resume method was never referenced in the needed location, so your test cases would never be invoked before timing out => \n\n' + str).stack);
                          process.exit(constants.EXIT_CODES.DELAY_NOT_REFERENCED);
                        });

                        return; //hard ugly and visible
                      }

                      const to = setTimeout(function () {
                        console.error('\n\n => Suman fatal error => delay function was not called within alloted time.');
                        process.exit(constants.EXIT_CODES.DELAY_FUNCTION_TIMED_OUT);
                      }, 11000);

                      var callable = true;
                      suite.__proto__.__resume = function (val) {
                        if (callable) {
                          callable = false;
                          clearTimeout(to);
                          d.exit();
                          process.nextTick(function () {  //need to make sure delay is called asynchronously, but this should take care of it
                            suite.__proto__.isSetupComplete = true; // keep this, needs to be called asynchronously
                            parent.__bindExtras();  //bind extras back to parent test
                            suite.__invokeChildren(val, callback); // pass callback
                          });
                        }
                        else {
                          console.error(' => Suman usage warning => suite.resume() was called more than once.');
                        }

                      };

                      cb.apply(suite, deps);

                    }

                  }
                );

              }
            });

          });
        };
      };

      _interface === 'TDD' ? this.suite = describe : this.describe = describe;
    }

    //Note: we hide most properties in the prototype
    TestSuite.prototype = Object.create(new TestSuiteBase(data));

    TestSuite.prototype.__bindExtras = function bindExtras() {

      const ctx = this;

      describe.delay = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.blockSignature);
        _args[1].delay = true;
        _args[1].__preParsed = true;
        describe.apply(ctx, _args);
      };

      describe.skip = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.blockSignature);
        _args[1].skip = true;
        _args[1].__preParsed = true;
        describe.apply(ctx, _args);
      };

      describe.only = function (desc, opts, fn) {
        suman.describeOnlyIsTriggered = true;
        const _args = pragmatik.parse(arguments, rules.blockSignature);
        _args[1].only = true;
        _args[1].__preParsed = true;
        describe.apply(ctx, _args);
      };

      it.skip = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.testCaseSignature);
        _args[1].skip = true;
        _args[1].__preParsed = true;
        return it.apply(ctx, _args);
      };

      it.only = function (desc, opts, fn) {
        suman.itOnlyIsTriggered = true;
        const _args = pragmatik.parse(arguments, rules.testCaseSignature);
        _args[1].only = true;
        _args[1].__preParsed = true;
        return it.apply(ctx, _args);
      };

      it.only.cb = function (desc, opts, fn) {
        suman.itOnlyIsTriggered = true;
        const _args = pragmatik.parse(arguments, rules.testCaseSignature);
        _args[1].only = true;
        _args[1].cb = true;
        _args[1].__preParsed = true;
        return it.apply(ctx, _args);
      };

      it.skip.cb = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.testCaseSignature);
        _args[1].skip = true;
        _args[1].cb = true;
        _args[1].__preParsed = true;
        return it.apply(ctx, _args);
      };

      it.cb = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.testCaseSignature);
        _args[1].cb = true;
        _args[1].__preParsed = true;
        return it.apply(ctx, _args);
      };

      it.cb.skip = it.skip.cb;
      it.cb.only = it.only.cb;

      before.cb = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.hookSignature);
        _args[1].cb = true;
        _args[1].__preParsed = true;
        return before.apply(ctx, _args);
      };

      before.skip = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.hookSignature);
        _args[1].skip = true;
        _args[1].__preParsed = true;
        return before.apply(ctx, _args);
      };

      // to save memory we can make this equivalence since if the hook is skipped
      // it won't matter if it's callback mode or not :)
      before.skip.cb = before.cb.skip = before.skip;

      after.cb = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.hookSignature);
        _args[1].cb = true;
        _args[1].__preParsed = true;
        return after.apply(ctx, _args);
      };

      after.skip = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.hookSignature);
        _args[1].skip = true;
        _args[1].__preParsed = true;
        return after.apply(ctx, _args);
      };

      // to save memory we can make this equivalence since if the hook is skipped
      // it won't matter if it's callback mode or not :)
      after.skip.cb = after.cb.skip = after.skip;

      beforeEach.cb = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.hookSignature);
        _args[1].cb = true;
        _args[1].__preParsed = true;
        return beforeEach.apply(ctx, _args);
      };

      beforeEach.skip = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.hookSignature);
        _args[1].skip = true;
        _args[1].__preParsed = true;
        return beforeEach.apply(ctx, _args);
      };

      // to save memory we can make this equivalence since if the hook is skipped
      // it won't matter if it's callback mode or not :)
      beforeEach.skip.cb = beforeEach.cb.skip = beforeEach.skip;

      afterEach.cb = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.hookSignature);
        _args[1].cb = true;
        _args[1].__preParsed = true;
        return afterEach.apply(ctx, _args);
      };

      afterEach.skip = function (desc, opts, fn) {
        const _args = pragmatik.parse(arguments, rules.hookSignature);
        _args[1].skip = true;
        _args[1].__preParsed = true;
        return afterEach.apply(ctx, _args);
      };

      // to save memory we can make this equivalence since if the hook is skipped
      // it won't matter if it's callback mode or not :)
      afterEach.skip.cb = afterEach.cb.skip = afterEach.skip;

    };


    TestSuite.prototype.__invokeChildren = function (val, start) {

      const testIds = _.pluck(this.getChildren(), 'testId');

      const children = allDescribeBlocks.filter(function (test) {
        return _.contains(testIds, test.testId);
      });

      async.eachSeries(children, makeRunChild(val), start);
    };

    TestSuite.prototype.toString = function () {
      return this.constructor + ':' + this.desc;
    };

    // TestSuite.prototype.log = function (data) {
    //     suman.log(data, this);
    // };

    TestSuite.prototype.series = function (cb) {
      if (typeof cb === 'function') {
        cb.apply(this, [(_interface === 'TDD' ? this.test : this.it).bind(this)]);
      }
      return this;
    };

    TestSuite.prototype.__startSuite = startSuite(suman, gracefulExit);

    freezeExistingProps(TestSuite.prototype);
    return freezeExistingProps(new TestSuite(data));

  };

  return TestSuiteMaker;

}

module.exports = makeTestSuiteMaker;
