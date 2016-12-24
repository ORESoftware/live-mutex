'use strict';

if (require.main === module) {
  throw new Error('=> Suman usage error => This file is not meant to be executed directly.');
}

var oncePostFn;
const sumanRuntimeErrors = global.sumanRuntimeErrors = global.sumanRuntimeErrors || [];
const fatalRequestReply = require('./helpers/fatal-request-reply');
const async = require('async');

if (process.env.SUMAN_DEBUG === 'yes') {
  console.log(' => Suman require.main => ', require.main.filename);
  console.log(' => Suman parent module => ', module.parent.filename);
}

process.on('warning', function (w) {
  console.error(w.stack || w);
});

process.on('uncaughtException', function (err) {

  if (typeof err !== 'object') {
    console.log(colors.bgMagenta.black(' => Error is not an object => ', util.inspect(err)));
    err = {stack: typeof err === 'string' ? err : util.inspect(err)}
  }

  if (err._alreadyHandledBySuman) {
    console.error(' => Error already handled => \n', (err.stack || err));
  }
  else {

    sumanRuntimeErrors.push(err);
    const msg = err.stack || err;

    err._alreadyHandledBySuman = true;
    console.error('\n\n', colors.magenta(' => Suman uncaught exception => \n' + msg));

    if (String(msg).match(/suite is not a function/i)) {
      process.stderr.write('\n\n => Suman tip => You may be using the wrong test interface try TDD instead of BDD or vice versa;' +
        '\n\tsee oresoftware.github.io/suman\n\n');
    }
    else if (String(msg).match(/describe is not a function/i)) {
      process.stderr.write('\n\n => Suman tip => You may be using the wrong test interface try TDD instead of BDD or vice versa;' +
        '\n\tsee oresoftware.github.io/suman\n\n');
    }

    if (!global.sumanOpts || (global.sumanOpts && global.sumanOpts.ignoreUncaughtExceptions !== false)) {
      global.sumanUncaughtExceptionTriggered = true;
      console.error('\n\n', ' => Given uncaught exception,' +
        ' Suman will now run suman.once.post.js shutdown hooks...');
      console.error('\n\n', ' ( => TO IGNORE UNCAUGHT EXCEPTIONS AND CONTINUE WITH YOUR TEST(S), use ' +
        'the "--ignore-uncaught-exceptions" option.)');

      async.parallel([

        function (cb) {
          if (!oncePostFn) {
            console.error(' => Suman internal warning, oncePostFn not yet defined.');
            return process.nextTick(cb);
          }
          oncePostFn(cb);
        },
        function (cb) {
          fatalRequestReply({
            type: constants.runner_message_type.FATAL,
            data: {
              error: msg,
              msg: msg
            }
          }, cb);
        }

      ], function (err, resultz) {

        const results = resultz[0];

        if (err) {
          console.error(err.stack || err);
        }
        if (Array.isArray(results)) {  // once-post was actually run this time versus (see below)
          results.filter(r => r).forEach(function (r) {
            console.error(r.stack || r);
          });
          process.nextTick(function () {
            process.exit(88);
            // process.exit(constants.EXIT_CODES.UNCAUGHT_EXCEPTION_BEFORE_ONCE_POST_INVOKED);
          });
        }
        else { // once-post was previously/already run
          process.nextTick(function () {
            process.exit(89);
            // process.exit(constants.EXIT_CODES.UNCAUGHT_EXCEPTION_AFTER_ONCE_POST_INVOKED);
          });
        }
      });
    }
  }

});

process.on('unhandledRejection', (reason, p) => {
  reason = (reason.stack || reason);
  console.error('Unhandled Rejection at: Promise ', p, '\n\n=> Rejection reason => ', reason, '\n\n=> stack =>', reason);

  if (!global.sumanOpts || (global.sumanOpts && global.sumanOpts.ignoreUncaughtExceptions !== false)) {
    global.sumanUncaughtExceptionTriggered = true;

    fatalRequestReply({
      type: constants.runner_message_type.FATAL,
      data: {
        error: reason,
        msg: reason
      }
    }, function () {
      process.exit(53); //have to hard-code in case suman-constants file is not loaded
    });

  }
});

/////////////////////////////////////////////////////////////////////

const weAreDebugging = require('./helpers/we-are-debugging');

//////////////////////////////////////////////////////////////////////

// core
const domain = require('domain');
const os = require('os');
const assert = require('assert');
const path = require('path');
const cp = require('child_process');
const EE = require('events');
const stream = require('stream');
const util = require('util');
const fs = require('fs');

// npm
const stack = require('callsite');
const _ = require('lodash');
const colors = require('colors/safe');
const pragmatik = require('pragmatik');
const debug = require('suman-debug')('s:index');

// project  //TODO: move these into init fn
const rules = require('./helpers/handle-varargs');
const makeSuman = require('./suman');
const ansi = require('ansi-styles');
const sumanUtils = require('suman-utils/utils');
const constants = require('../config/suman-constants');
const acquireDeps = require('./acquire-deps');
const acquireIntegrantsSingleProcess = require('./acquire-integrants-single-proc');
var sumanId = global.sumanId = 0;

///////////////////////////////////////////////////////////////////////////////////////////

//integrants
var integPreConfiguration = null;
const allOncePreKeys = global.oncePreKeys = [];
const allOncePostKeys = global.oncePostKeys = [];
const integrantsEmitter = global.integrantsEmitter = (global.integrantsEmitter || new EE());
const integProgressEmitter = global.integProgressEmitter = (global.integProgressEmitter || new EE());
const integContainer = global.integContainer = (global.integContainer || {});
const integProgressContainer = global.integProgressContainer = (global.integProgressContainer || {});

//ioc
const iocEmitter = global.iocEmitter = (global.iocEmitter || new EE());
const iocContainer = global.iocContainer = (global.iocContainer || {});
const iocProgressContainer = global.iocProgressContainer = (global.iocProgressContainer || {});

// results and reporteers
const resultBroadcaster = global.resultBroadcaster = (global.resultBroadcaster || new EE());
const sumanReporters = global.sumanReporters = (global.sumanReporters || []);
const suiteResultEmitter = global.suiteResultEmitter = (global.suiteResultEmitter || new EE());

////////////////////////////////////////////////////////////////////////////////////////////

const pkgDotJSON = require('../package.json');

var gv;
if (gv = process.env.SUMAN_GLOBAL_VERSION) {
  const lv = String(pkgDotJSON.version);


  debug(' => Global version => ', gv);
  debug(' => Local version => ', lv);


  if (gv !== lv) {
    console.error('\n\n', colors.red(' => Suman warning => You local version of Suman differs from the cli version of Suman.'));
    console.error(colors.cyan(' => Global version => '), gv);
    console.error(colors.cyan(' => Local version => '), lv, '\n\n');
  }
}

///////////////////////////////////////////////////////////////////////////////////////////

const counts = require('./helpers/suman-counts');
const cwd = process.cwd();
const projectRoot = global.projectRoot = global.projectRoot || sumanUtils.findProjectRoot(cwd);

////////////////////////////////////////////////////////////////////////////////////////////

require('./helpers/handle-suman-counts');
 oncePostFn = require('./helpers/handle-suman-once-post');


////////////////////////////////////////////////////////////////////////

// here comes the hotstepper
// cache these values for purposes of SUMAN_SINGLE_PROCESS option
const singleProc = process.env.SUMAN_SINGLE_PROCESS === 'yes';
const isViaSumanWatch = process.env.SUMAN_WATCH === 'yes';
const main = require.main.filename;
const sumanOptsFromRunner = global.sumanOpts || (process.env.SUMAN_OPTS ? JSON.parse(process.env.SUMAN_OPTS) : {});
const sumanOpts = global.sumanOpts = global.sumanOpts || sumanOptsFromRunner;
const usingRunner = global.usingRunner = (global.usingRunner || process.env.SUMAN_RUNNER === 'yes');

//could potentially pass dynamic path to suman config here, but for now is static
const sumanConfig = require('./helpers/load-suman-config')(null);

if (!global.usingRunner && !global.viaSuman) {
  require('./helpers/print-version-info'); // just want to run this once
}

if (global.sumanOpts.verbose && !usingRunner && !global.viaSuman) {
  console.log(' => Suman verbose message => Project root:', projectRoot);
}

const sumanPaths = require('./helpers/resolve-shared-dirs')(sumanConfig, projectRoot);
const sumanObj = require('./helpers/load-shared-objects')(sumanPaths, projectRoot);

/////////// cannot wait to use obj destruring /////////////////////////////////
const integrantPreFn = sumanObj.integrantPreFn;
const iocFn = sumanObj.iocFn;
const testDebugLogPath = sumanPaths.testDebugLogPath;
const testLogPath = sumanPaths.testLogPath;

fs.writeFileSync(testDebugLogPath, '\n', {flag: 'w'});
fs.writeFileSync(testLogPath, '\n => New Suman run @' + new Date(), {flag: 'w'});

////////////////////////////////////////////////////////////////////////////////

if (!global.viaSuman && !usingRunner && global.sumanReporters.length < 1) {
  const fn = require(path.resolve(__dirname + '/reporters/std-reporter'));
  assert(typeof fn === 'function', 'Native reporter fail.');
  global.sumanReporters.push(fn);
  fn.apply(global, [global.resultBroadcaster]);
}

//////////////////////////////////////////////////////////////////////////////////////

var loaded = false;
var moduleCount = 0;

function init($module, $opts) {

  ///////////////////////////////////
  debugger;  // leave this here forever for debugging child processes

  /*
   Please note that the init function is complex by nature. Easily the most complicated function
   in this project by an order of magnitude. Here we have to deal with several different
   conditionals:

   (1) using runner or not
   (2) using suman or node
   (3) SUMAN_SINGLE_PROCESS (running tests all in a single process) or standard
   (4) Waiting for suman.once.pre to finish ("integrants")

   How this function works:

   Test.create/describe/suite are called synchronously; once that function is called,
   we wait for any relevant integrants to start/finish

   */
  ///////////////////////////////////

  global.sumanInitCalled = true;
  global.sumanInitStartDate = (global.sumanInitStartDate || Date.now());
  global._currentModule = $module.filename;

  require('./handle-exit'); // handle exit here

  if (this instanceof init) {
    console.error('\n', ' => Suman usage warning: no need to use "new" keyword with the suman.init()' +
      ' function as it is not a standard constructor');
    return init.apply(null, arguments);
  }

  //////

  debug(' => Suman debug message => require.main.filename => ',
    '"' + require.main.filename + '"');

  debug(' => Suman debug message => suman index was required from module (module.parent) => ',
    module.parent.filename);

  if (module.parent && module.parent.parent) {
    debug(' => Suman debug message => (module.parent.parent) => ',
      module.parent.parent.filename);
  }

  if (module.parent && module.parent.parent && module.parent.parent.parent) {
    debug(' => Suman debug message => (module.parent.parent.parent) => ',
      module.parent.parent.parent.filename);
  }


  if (init.$ingletonian) {
    if (process.env.SUMAN_SINGLE_PROCESS !== 'yes') {
      console.error(colors.red(' => Suman usage warning => suman.init() only needs to be called once per test file.'));
      return init.$ingletonian;
    }
  }

  // TODO: could potention figure out what original test module is via suman.init call, instead of
  // requiring that user pass it explicitly

  if (!loaded) {

    //note that these calls need to be inside suman.init() so they don't get loaded by the runner, etc.
    //although perhaps we should put the runner code elsewhere, because user does not need to call runner
    //look through version control from Sunday Nov 20th for this code
  }

  assert(($module.constructor && $module.constructor.name === 'Module'),
    'Please pass the test file module instance as first arg to suman.init()');
  if ($opts) {
    assert(typeof $opts === 'object' && !Array.isArray($opts),
      'Please pass an options object as a second argument to suman.init()');
  }

  var matches = false;
  if (usingRunner) { //when using runner cwd is set to project root or test file path
    if (process.env.SUMAN_CHILD_TEST_PATH === $module.filename) {
      matches = true;
    }
  }
  else {  //if we run
    if (global.sumanOpts.vverbose) {
      console.log(' => Suman vverbose message => require.main.filename value:', main);
    }
    if (main === $module.filename) {
      matches = true;
    }
  }

  const opts = $opts || {};

  const series = !!opts.series;
  const writable = opts.writable;

  if ($module._sumanInitted) {
    console.error(' => Suman warning => suman.init() already called for this module with filename => ', $module.filename);
    return;
  }

  $module._sumanInitted = true;
  moduleCount++;
  const testSuiteQueue = $module.testSuiteQueue = [];

  suiteResultEmitter.on('suman-completed', function () {
    //this code should only be invoked if we are using Test.create's in series
    testSuiteQueue.pop();
    var fn;
    if (fn = testSuiteQueue[testSuiteQueue.length - 1]) {
      debug(' => Running testSuiteQueue fn => ', String(fn));
      fn.apply(null);
    }
    else {
      debug(' => Suman testSuiteQueue is empty.');
    }
  });

  //TODO: perhaps we could do some bookkeeping on $module itself so that only if init is called twice on that particular module
  // do we barf
  //TODO: verify that writable is actually a proper writable stream
  const exportEvents = $module.exports = (writable || Transform());
  exportEvents.counts = {
    sumanCount: 0
  };
  // const testsuites = exportEvents._testsuites = exportEvents._testsuites || [];

  Object.defineProperty($module, 'exports', {
    //freeze module exports to avoid horrible bugs
    writable: false
  });

  //TODO: allow users to have multiple suman.conf.js files for different tests in their project?
  // const configPath = opts.sumanConfigPath;

  const integrants = opts.integrants || opts.pre || [];
  assert(Array.isArray(integrants), '"integrants" must be an array type.');

  if (opts.__expectedExitCode !== undefined && process.env.SUMAN_SINGLE_PROCESS !== 'yes') {
    const expectedExitCode = global.expectedExitCode = global.expectedExitCode || opts.__expectedExitCode;
    assert(Number.isInteger(expectedExitCode) && expectedExitCode > -1, ' => Suman usage error => Expected exit ' +
      'code not an acceptable integer.');
  }

  if (opts.timeout !== undefined && process.env.SUMAN_SINGLE_PROCESS !== 'yes') {
    const timeout = global.expectedTimeout = opts.timeout;
    assert(Number.isInteger(timeout) && timeout > 0, ' => Suman usage error => Expected timeout value ' +
      'is not an acceptable integer.');

    setTimeout(function () {
      console.log('\n', new Error('=> Suman test file has timed out -' +
        ' "timeout" value passed to suman.init() has been reached exiting....').stack);
      process.exit(constants.EXIT_CODES.TEST_FILE_TIMEOUT);
    }, timeout);

  }

  const $oncePost = opts.post || [];
  assert(Array.isArray($oncePost), '"post" option must be an array type.');

  const waitForResponseFromRunnerRegardingPostList = $oncePost.length > 0;
  const waitForIntegrantResponses = integrants.length > 0;

  //pass oncePost so that we can use it later when we need to
  allOncePostKeys.push($oncePost);
  allOncePreKeys.push(integrants);

  const _interface = String(opts.interface).toUpperCase() === 'TDD' ? 'TDD' : 'BDD';


  const filenames = [
    $module.filename,
    require.resolve('./run-child.js'),
    require.resolve('../cli.js')
  ];


  const exportTests = (opts.export === true || singleProc || global._sumanIndirect);
  const iocData = opts.iocData || opts.ioc || {};

  if (iocData) {
    try {
      assert(typeof iocData === 'object' && !Array.isArray(iocData),
        colors.red(' => Suman usage error => "ioc" property passed to suman.init() needs ' +
          'to point to an object'));
    }
    catch (err) {
      console.log(err.stack);
      process.exit(constants.EXIT_CODES.IOC_PASSED_TO_SUMAN_INIT_BAD_FORM);
    }
  }

  if (exportTests) {
    //TODO: if export is set to true, then we need to exit if we are using the runner
    if (process.env.SUMAN_DEBUG === 'yes' || global.sumanOpts.vverbose) {
      console.log(colors.magenta(' => Suman message => export option set to true.'));
    }
  }

  //////////////////////////////////////////////////////////////////

  if (usingRunner) {

    // fs.writeFileSync(errStrmPath, '\n', {flags: 'a', encoding: 'utf8'});
    // fs.appendFileSync(errStrmPath, 'start', {flags: 'a'});

    global._writeTestError = function () {

      const data = Array.prototype.slice.call(arguments).filter(i => i);

      data.forEach(function (d) {

        if (typeof d !== 'string') {
          d = util.inspect(d);
        }

        process.stderr.write(d);  //goes to runner

        if (process.env.SUMAN_DEBUG === 'yes') {
          fs.appendFileSync(testDebugLogPath, d);
        }
      });

    };

    global._writeLog = function (data) {
      // use process.send to send data to runner? or no-op
      if (process.env.SUMAN_DEBUG === 'yes') {
        fs.appendFileSync(testDebugLogPath, data);
      }
    }
  }
  else {

    if (process.env.SUMAN_SINGLE_PROCESS === 'yes') {
      fs.writeFileSync(testLogPath,
        '\n => [SUMAN_SINGLE_PROCESS mode] Next Suman run @' + new Date() +
        '\n Test file => "' + $module.filename + '"', {flag: 'a'});
    }
    else {
      fs.writeFileSync(testLogPath,
        '\n\n => Test file => "' + $module.filename + '"\n\n', {flag: 'a'});
    }

    global._writeLog = function (data) {
      fs.appendFileSync(testLogPath, data);
    };

    // const strm = global.testStderrStrm = fs.createWriteStream(errStrmPath, {flags: 'w'});

    global._writeTestError = function (data, ignore) {
      if (!ignore) {
        global.checkTestErrorLog = true;
      }
      // strm.write.apply(strm, arguments);
      fs.appendFileSync(testDebugLogPath, '\n' + data + '\n');
    };

    fs.writeFileSync(testDebugLogPath, '\n\n', {flags: 'a', encoding: 'utf8'});
    global._writeTestError('\n\n', true);
    global._writeTestError(' ### Suman start run @' + new Date(), true);
    global._writeTestError(' ### Filename => ' + $module.filename, true);
    global._writeTestError(' ### Command => ' + JSON.stringify(process.argv), true);
  }

  ////////////////////////////////////////////////////////////////

  var integrantsFn = null;
  var integrantsReady = null;
  var postOnlyReady = null;

  if (waitForIntegrantResponses || process.env.SUMAN_SINGLE_PROCESS === 'yes') {
    integrantsReady = false;
  }

  if (waitForResponseFromRunnerRegardingPostList) {
    postOnlyReady = false;
  }

  if (integrants.length < 1) {
    integrantsFn = function (emitter) {
      process.nextTick(function () {
        if (emitter) {
          //this emitter is sumanEvents for single process mode
          emitter.emit('vals', {});
        }
        else {
          integrantsEmitter.emit('vals', {});
        }
      });
    }
  }
  else if (global.usingRunner) {

    integrantsFn = function () {

      const integrantsFromParentProcess = [];
      const oncePreVals = {};

      if (integrantsReady) {
        process.nextTick(function () {
          integrantsEmitter.emit('vals', oncePreVals);
        });
      }
      else {
        var integrantMessage = function (msg) {
          if (msg.info === 'integrant-ready') {
            integrantsFromParentProcess.push(msg.data);
            oncePreVals[msg.data] = msg.val;
            if (sumanUtils.checkForEquality(integrants, integrantsFromParentProcess)) {
              integrantsReady = true;
              if (postOnlyReady !== false) {
                process.removeListener('message', integrantMessage);
                integrantsEmitter.emit('vals', oncePreVals);
              }
            }
          }
          else if (msg.info === 'integrant-error') {
            process.removeListener('message', integrantMessage);
            integrantsEmitter.emit('error', msg);
          }
          else if (msg.info === 'once-post-received') {
            // note: we need to make sure the runner received the "post" requirements of this test
            // before this process exits
            postOnlyReady = true;
            if (integrantsReady !== false) {
              process.removeListener('message', integrantMessage);
              integrantsEmitter.emit('vals', oncePreVals);
            }
          }
        };

        process.on('message', integrantMessage);
        process.send({
          type: constants.runner_message_type.INTEGRANT_INFO,
          msg: integrants,
          oncePost: $oncePost,
          expectedExitCode: global.expectedExitCode,
          expectedTimeout: global.expectedTimeout
        });
      }
    }
  }
  else {
    integrantsFn = function (emitter) {

      //TODO: if multiple test files are reference in project and it is run without the runner,
      // we need to check if integrants are already ready

      //declared at top of file
      integPreConfiguration =
        (integPreConfiguration || integrantPreFn({temp: 'we are in suman project => lib/index.js'}));

      const d = domain.create();

      d.once('error', function (err) {

        err = new Error(' => Suman fatal error => there was a problem verifying the ' +
          'integrants listed in test file "' + $module.filename + '"\n' + (err.stack || err));

        fatalRequestReply({
          type: constants.runner_message_type.FATAL,
          data: {
            msg: err,
            stack: err
          }
        }, function () {
          console.error(err.stack);
          global._writeTestError(err.stack);
          process.exit(constants.EXIT_CODES.INTEGRANT_VERIFICATION_FAILURE);
        });

      });

      d.run(function () {

        if (process.env.SUMAN_SINGLE_PROCESS === 'yes') {

          acquireIntegrantsSingleProcess(integrants, integPreConfiguration, sumanUtils.onceAsync(null, function (err, vals) {
            d.exit();
            process.nextTick(function () {
              if (err) {
                emitter.emit('error', err);
              }
              else {
                emitter.emit('vals', vals);
              }
            });

          }));

        }
        else {
          acquireDeps(integrants, integPreConfiguration, sumanUtils.onceAsync(null, function (err, vals) {
            d.exit();
            process.nextTick(function () {
              if (err) {
                integrantsEmitter.emit('error', err);
              }
              else {
                integrantsEmitter.emit('vals', vals);
              }
            });

          }));
        }

      });
    }
  }

  var integrantsInvoked = false;
  init.tooLate = false;

  function start(desc, opts, cb) {

    //this call will validate args
    const args = pragmatik.parse(arguments, rules.blockSignature);

    if (init.tooLate === true && process.env.SUMAN_SINGLE_PROCESS !== 'yes') {
      console.error(' => Suman usage fatal error => You must call Test.describe() synchronously => ' +
        'in other words, all Test.describe() calls should be registered in the same tick of the event loop.');
      return process.exit(constants.EXIT_CODES.ASYNCHRONOUS_CALL_OF_TEST_DOT_DESCRIBE);
    }

    const sumanEvents = Transform();
    sumanEvents.on('test', function () {
      debug('SUMAN EVENTS test!');
      exportEvents.emit.bind(exportEvents, 'test').apply(exportEvents, arguments);
    });
    sumanEvents.on('error', function () {
      debug('SUMAN EVENTS error!');
      exportEvents.emit.bind(exportEvents, 'error').apply(exportEvents, arguments);
    });
    sumanEvents.on('suman-test-file-complete', function () {
      debug('SUMAN EVENTS suman-test-file-complete!');
      exportEvents.emit.bind(exportEvents, 'suman-test-file-complete').apply(exportEvents, arguments);
    });

    // testsuites.push(sumanEvents);

    process.nextTick(function () {
      init.tooLate = true;
    });

    //counts just for this $module
    exportEvents.counts.sumanCount++;
    //counts for all sumans in this whole Node.js process
    counts.sumanCount++;

    debug(' in index => exportEvents count =>',
      exportEvents.counts.sumanCount, ' => counts.sumanCount => ', counts.sumanCount);

    const to = setTimeout(function () {
      console.error(' => Suman usage error => Integrant acquisition timeout.');
      process.exit(constants.EXIT_CODES.INTEGRANT_ACQUISITION_TIMEOUT);
    }, global.weAreDebugging ? 50000000 : 50000);

    function onPreVals(vals) {

      clearTimeout(to);

      if (!global.iocConfiguration || process.env.SUMAN_SINGLE_PROCESS === 'yes') {

        iocData['suman.once.pre.js'] = vals;
        // should copy the data not directly reference it, should be stringifiable/serializable
        global.userData = JSON.parse(JSON.stringify(iocData));

        //TODO: perhaps pass suman.once.pre.js data to ioc also
        //Note that since "suman single process" mode processes each file in series,
        // we overwrite the global iocConfiguration var, dangerously
        global.iocConfiguration = iocFn(iocData) || {};
      }

      //TODO: need to properly toggle boolean that determines whether or not to try to create dir
      makeSuman($module, _interface, true, sumanConfig, function (err, suman) {

        if (err) {
          global._writeTestError(err.stack || err);
          return process.exit(constants.EXIT_CODES.ERROR_CREATED_SUMAN_OBJ);
        }

        if (process.env.SUMAN_SINGLE_PROCESS === 'yes') {
          if (exportEvents.listenerCount('test') < 1) {
            throw new Error(' => We are in "SUMAN_SINGLE_PROCESS" mode but nobody is listening for test events. ' +
              'To run SUMAN_SINGLE_PROCESS mode you need to use the suman executable, not plain node.');
          }
        }

        suman._sumanModulePath = $module.filename;

        if (exportTests && matches) {

          const $code = constants.EXIT_CODES.EXPORT_TEST_BUT_RAN_TEST_FILE_DIRECTLY;

          const msg = ' => Suman usage error => You have declared export:true in your suman.init call, but ran the test directly.';
          console.error(msg);

          return fatalRequestReply({
            type: constants.runner_message_type.FATAL,
            data: {
              error: msg,
              msg: msg
            }
          }, function () {

            global._writeTestError(' => Suman usage error => You have declared export:true in your suman.init call, but ran the test directly.');
            suman.logFinished(null, function () {
              process.exit($code);  //use original code
            });

          });

        }
        else {

          suman._sumanEvents = sumanEvents;

          const run = require('./exec-suite').main(suman);

          if (process.domain) {
            try {
              process.domain.exit();
            }
            catch (err) {

            }
          }

          setImmediate(function () {

            // IMPORTANT: setImmediate allows for future possibility of multiple test suites referenced in the same file
            // other async "integrantsFn" probably already does this

            if (exportTests === true) { //TODO: if we use this, need to make work with integrants/blocked etc.

              if (series) {

                var fn = function () {
                  console.log(' => suman id => ', suman.sumanId);
                  suman.extraArgs = Array.prototype.slice.call(arguments);
                  run.apply(null, args);  //args are most likely (desc,opts,cb)
                };

                $module.testSuiteQueue.unshift(fn);

                sumanEvents.on('suman-test-file-complete', function () {
                  //this code should only be invoked if we are using Test.create's in series
                  testSuiteQueue.pop();
                  var fn;
                  if (fn = testSuiteQueue[testSuiteQueue.length - 1]) {
                    sumanEvents.emit('test', fn);
                  }
                  else {
                    console.error(colors.red.bold(' => Suman implementation error => Should not be empty.'));
                  }

                });

                if ($module.testSuiteQueue.length === 1) {
                  sumanEvents.emit('test', fn);
                }

              }
              else {
                sumanEvents.emit('test', function () {

                  console.log('ARGUMENTS => ', arguments);
                  suman.extraArgs = Array.prototype.slice.call(arguments);
                  run.apply(global, args);
                });
              }

              if (false && writable) {
                args.push([]); // [] is empty array representing extra/ $uda
                args.push(writable); //TODO: writable should be same as sumanEvents (?)
                // args.push(iocData);
                // args.push(suman.userData);
                run.apply(global, args);
              }

            }
            else {

              if (series) {

                var fn = function () {
                  run.apply(null, args);  //args are most likely (desc,opts,cb)
                };

                $module.testSuiteQueue.unshift(fn);

                if ($module.testSuiteQueue.length === 1) {
                  fn.apply(null, args);  //args are most likely (desc,opts,cb)
                }

              }
              else {
                run.apply(null, args);  //args are most likely (desc,opts,cb)
              }

            }
          });
        }

      });

    }

    if (process.env.SUMAN_SINGLE_PROCESS !== 'yes') {
      integrantsEmitter.once('error', function (err) {
        clearTimeout(to);
        console.error(err.stack || err);
        global._writeTestError(err.stack || err);
        process.exit(constants.EXIT_CODES.INTEGRANT_VERIFICATION_ERROR);
      });

      integrantsEmitter.once('vals', onPreVals);
    }
    else {
      sumanEvents.once('vals', onPreVals);
    }

    //we run integrants function
    process.nextTick(function () {
      if (!integrantsInvoked || (process.env.SUMAN_SINGLE_PROCESS === 'yes')) {
        //always run this if we are in SUMAN_SINGLE_PROCESS mode.
        integrantsInvoked = true;
        const emitter = (process.env.SUMAN_SINGLE_PROCESS === 'yes' ? sumanEvents : null);
        debug('calling integrants fn');
        integrantsFn(emitter);
      }
      else {
        debug('integrantsInvoked more than once for non-SUMAN_SINGLE_PROCESS mode run',
          'process.env.SUMAN_SINGLE_PROCESS => ' + process.env.SUMAN_SINGLE_PROCESS);
      }
    });

  }

  init.$ingletonian = {
    parent: $module.parent, //parent is who required the original $module
    file: global.sumanTestFile = $module.filename
  };

  start.skip = init.$ingletonian.skip = function () {
    const args = pragmatik.parse(arguments, rules.blockSignature);
    args[1].skip = true;
    start.apply(this, args);
  };

  start.only = init.$ingletonian.only = function () {
    const args = pragmatik.parse(arguments, rules.blockSignature);
    global.describeOnlyIsTriggered = true;
    args[1].only = true;
    start.apply(this, args);
  };

  start.delay = init.$ingletonian.delay = function () {
    const args = pragmatik.parse(arguments, rules.blockSignature);
    args[1].delay = true;
    start.apply(this, args);
  };

  const create = init.$ingletonian.create = start;
  _interface === 'TDD' ? init.$ingletonian.suite = create : init.$ingletonian.describe = create;

  loaded = true;
  return init.$ingletonian;
}

function Writable(type) {

  if (this instanceof Writable) {
    return Writable.apply(global, arguments);
  }

  //type: duplex, transform etc

  const strm = new stream.Writable({
    write: function (chunk, encoding, cb) {
      console.log('index chunks:', String(chunk));
    }
  });
  strm.cork();

  return strm;

}

//TODO: https://gist.github.com/PaulMougel/7961469

function Transform(obj) {

  //TODO: http://stackoverflow.com/questions/10355856/how-to-append-binary-data-to-a-buffer-in-node-js

  // const strm = new stream.Transform({
  //
  //     transform: function (chunk, encoding, cb) {
  //
  //         var data = chunk.toString();
  //         if (this._lastLineData) {
  //             data = this._lastLineData + data;
  //         }
  //
  //         console.log('data:', data);
  //
  //         var lines = data.split('\n');
  //         this._lastLineData = lines.splice(lines.length - 1, 1)[0];
  //
  //         lines.forEach(this.push.bind(this));
  //         cb();
  //     }
  // });

  var BufferStream = function () {
    stream.Transform.apply(this, arguments);
    this.buffer = [];
  };

  util.inherits(BufferStream, stream.Transform);

  BufferStream.prototype._transform = function (chunk, encoding, done) {
    // custom buffering logic
    // ie. add chunk to this.buffer, check buffer size, etc.

    this.push(chunk ? String(chunk) : null);
    this.buffer.push(chunk ? String(chunk) : null);

    done();
  };

  BufferStream.prototype.pipe = function (destination, options) {
    var res = stream.Transform.prototype.pipe.apply(this, arguments);
    this.buffer.forEach(function (b) {
      res.write(String(b));
    });
    return res;
  };

  // strm.cork();
  return new BufferStream();

}

function autoPass() {
  // add t.skip() type functionality // t.ignore().
}

function autoFail() {
  throw new Error('Suman auto-fail. Perhaps flesh-out this hook or test to get it passing.');
}

function once(fn) {

  var cache = null;

  return function (cb) {

    if (cache) {
      process.nextTick(function () {
        cb.apply(null, [null, cache]);
      });
    }
    else {
      fn.apply(null, function (err, val) {
        if (!err) {
          cache = val || {
              'Suman says': 'This is a dummy-cache val. ' +
              'See => oresoftware.github.io/suman/tricks-and-tips.html'
            };
        }
        cb.apply(null, arguments);
      });
    }
  }
}


function load(opts) {

  if (typeof opts !== 'object') {
    throw new Error(' => Suman usage error => Please pass in an options object to the suman.load() function.')
  }

  const pth = opts.path;
  const indirect = !!opts.indirect;

  assert(path.isAbsolute(pth), ' => Suman usage error => Please pass in an absolute path to suman.load() function.');
  // ughhh, not pretty, have to use this methodology to tell Suman to "export" tests
  global._sumanIndirect = indirect;
  const exp = require(pth);
  global._sumanIndirect = null;
  return exp;
}


module.exports = {
  load: load,
  autoPass: autoPass,
  autoFail: autoFail,
  init: init,
  constants: constants,
  Writable: Writable,
  Transform: Transform,
  once: once
};

// if(require.main === module){
//     console.log(' => Suman message => running Suman index.');
//     return require('../index');  //when user wants to execute Suman, force usage of other index file
// }
