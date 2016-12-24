// 'use strict';

/////////////////////////////////////////////////////

// probably will never have to mess with these options:
// execArgv: ['--expose-gc', '--harmony',
// '--max-executable-size='.concat(MEMORY_PER_PROCESS),
// '--max_old_space_size='.concat(MEMORY_PER_PROCESS),
// '--max_semi_space_size='.concat(MEMORY_PER_PROCESS)],

/////////////////////////////////////////////////////

const slicedArgs = process.argv.slice(2);
const execArgs = process.execArgv.slice(0);

//////////////////////////////////////////////////////////

const weAreDebugging = require('./helpers/we-are-debugging');

///////////////////////////////////////////////////

if (false) {
  //this is useful for detective work to find out what might be logging
  const stdout = process.stdout.write.bind(process.stdout);
  process.stdout.write = function (data) {
    stdout(new Error(String(data)).stack);
    stdout.apply(null, arguments);
  };

  const stderr = process.stderr.write.bind(process.stderr);
  process.stderr.write = function (data) {
    stderr(new Error(String(data)).stack);
    stderr.apply(null, arguments);
  };
}

///////////////////////////////////////////////////

//core
const assert = require('assert');
const util = require('util');
const EE = require('events');
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const os = require('os');
const domain = require('domain');

//npm
const AsciiTable = require('ascii-table');
// const Immutable = require('immutable');
const async = require('async');
const _ = require('lodash');
const ijson = require('siamese');
const readline = require('readline');
const colors = require('colors/safe');
const a8b = require('ansi-256-colors'), fg = a8b.fg, bg = a8b.bg;
const makeBeep = require('make-beep');
const events = require('suman-events');
const debug = require('suman-debug')('s:runner');

//project
const noFilesFoundError = require('./helpers/no-files-found-error');
const constants = require('../config/suman-constants');
const finalizeOutput = require('./helpers/finalize-output');
const ascii = require('./helpers/ascii');
const sumanUtils = require('suman-utils/utils');
// const runnerLogger = require('./sync-logger');
const makeHandleBlocking = require('./runner-helpers/make-handle-blocking');
const resultBroadcaster = global.resultBroadcaster = global.resultBroadcaster || new EE();

//////////////////////////////////////////////
const testResultsEmitter = new EE();
const cwd = process.cwd();
const projectRoot = global.projectRoot = global.projectRoot || sumanUtils.findProjectRoot(cwd);
const maxProcs = global.maxProcs;

//TODO: https://github.com/mochajs/mocha/wiki/Third-party-reporters

const messages = [];
// const tableRows = [];
const tableRows = {};
const integrantHash = {};
const integrantHashKeyValsForSumanOncePost = {};
const userData = {}; // user will send data to runner for any/all tests, once before they exit
const config = global.sumanConfig;
const timestamp = global.timestamp;
var doneCount = 0;
var tableCount = 0;
var listening = true;
var processId = 1;
var server, startTime, endTime, networkLog, forkedCPs = [],
  handleBlocking, depContainerObj = null, bailed = false;

var oncePostModule = null;

var queuedCpsObj = {
  queuedCPs: []
};

process.on('exit', function (code, signal) {

  if (signal) {
    resultBroadcaster.emit(events.RUNNER_EXIT_SIGNAL,
      ['<::::::::::::::::::::: Runner Exit Signal => ' + signal + ' ::::::::::::::::::::::::>'].join('\n'));
  }

  if (code > 0) {
    //make a beep noise if a failing run
    // resultBroadcaster.emit('exit-code-greater-than-zero', '\007');
    resultBroadcaster.emit(events.RUNNER_EXIT_CODE_GREATER_THAN_ZERO, code);
  }
  else {
    resultBroadcaster.emit(events.RUNNER_EXIT_CODE_IS_ZERO);
  }

  resultBroadcaster.emit(events.RUNNER_EXIT_CODE, ['\n\n  ',
    ' <::::::::::::::::::::::::::::::::: Suman runner exiting with exit code: ' + code +
    ' :::::::::::::::::::::::::::::::::>', '\n'].join('\n'));


  //write synchronously to ensure it gets written
  fs.appendFileSync(global.sumanRunnerStderrStreamPath, '\n\n\n### Suman runner end ###\n\n\n\n\n\n\n');
});

process.on('error', function (err) {
  //TODO: add process.exit(special code);
  console.error('error in runner:\n', err.stack || err);
});

process.on('uncaughtException', function (e) {
  //TODO: add process.exit(special code);
  console.error('\n\n=> Suman runner uncaughtException...\n', e.stack || e);
});

process.on('message', function (data) {
  //TODO: add process.exit(special code);
  console.error('!!! => Suman runner received a message:', util.inspect(typeof data === 'string' ? data : data));
});

const noColors = process.argv.indexOf('--no-color') > 0;

if (process.env.SUMAN_DEBUG === 'yes') {
  console.log(' => NO COLORS => ', noColors);
}

function logTestResult(data, n) {

  const test = data.test;

  resultBroadcaster.emit('test-case-end', test.desc, test);

  if (test.errorDisplay) {
    resultBroadcaster.emit(events.TEST_CASE_FAIL,
      '\n\n\t' + colors.bgWhite.black.bold(' ' + (noColors ? '(x)' : '\u2718') + '   => test fail ') + '  \'' +
      test.desc + '\'\n\t' + colors.bgYellow.black(' Originating entry test path => ')
        + colors.bgYellow.gray.bold(test.sumanModulePath + ' ') + '\n' + colors.yellow(test.errorDisplay) + '\n\n', test);
  }
  else {

    if (test.skipped) {
      resultBroadcaster.emit(events.TEST_CASE_SKIPPED, '\t' +
        colors.yellow(' ' + (noColors ? '(-)' : '\u21AA')) + ' (skipped) \'' + test.desc + '\'\n', test);
    }
    else if (test.stubbed) {
      resultBroadcaster.emit(events.TEST_CASE_STUBBED, '\t' +
        colors.yellow(' ' + (noColors ? '(---)' : '\u2026')) + ' (stubbed) \'' + test.desc + '\'\n', test);
    }
    else {

      resultBroadcaster.emit(events.TEST_CASE_PASS, '\t' +
        colors.blue(' ' + (noColors ? '(check)' : '\u2714 ')) + ' \'' + test.desc + '\' ' +
        (test.dateComplete ? '(' + ((test.dateComplete - test.dateStarted) || '< 1') + 'ms)' : '') + '\n', test);

      //TODO: allow printing of just one line of results, until a failure
      //readline.clearLine(process.stdout, 0);
      //process.stdout.write('\r' + colors.green('Pass count: ' + successCount));

    }
  }
}

function handleTableData(n, data) {

  tableCount++;
  tableRows[n.shortTestPath].tableData = data;
  n.send({
    info: 'table-data-received'
  });

}

function logTestData(data) {

  // if (setup.usingLiveSumanServer) {
  //     networkLog.sendTestData(data);
  // }
  // else {

  throw new Error('this should not be used currently');

  //TODO: fix this
  var json = JSON.stringify(data.test);

  if (data.outputPath) {
    // console.log('data from test:',json);
    fs.appendFileSync(data.outputPath, json += ',');  //sync call so that writes don't get corrupted

  }
  else {
    throw new Error('not outputPath...!');
  }
  // }

}

function mapCopy(copy) {
  return Object.keys(copy).map(key => {
    const val = copy[key];
    return val.value ? val.value : val.default;
  });
}

function makeExit(messages, timeDiff) {

  if (process.env.SUMAN_DEBUG == 'yes') {
    console.log('\n\n\n\tTable count:', tableCount);
    console.log('\tDone count:', doneCount);
  }

  resultBroadcaster.emit(events.RUNNER_ENDED, new Date().toISOString());

  var exitCode = 0;

  messages.every(function (msg) {  //use [].every hack to return more quickly

    const code = msg.code;
    const signal = msg.signal;

    if (!Number.isInteger(code)) {
      console.error(colors.red.bold(' => Suman implementation error => exit code is non-integer => '), code);
    }

    if (code > 0) {
      exitCode = 1;
      return false;
    }
    return true;

  });

  const table1 = new AsciiTable('Suman Runner Results');
  const table2 = new AsciiTable('Overall Stats');

  //TODO: need to reconcile this with tests files that do not complete

  const keys = Object.keys(tableRows);

  const totals = {
    SUMAN_IGNORE: '',
    bailed: bailed ? 'YES' : 'no',
    suitesPassed: 0,
    suitesFailed: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsSkipped: 0,
    testsStubbed: 0,
    allTests: 0,
    totalTime: timeDiff
  };

  const constantTableData = constants.tableData;

  table1.setHeading.apply(table1, Object.keys(constantTableData).map(key => constantTableData[key].name));

  const storeRowsHereIfUserWantsSortedData = [];

  keys.forEach(function (key) {

    const item = tableRows[key];
    const tableDataFromCP = item.tableData;
    const copy = JSON.parse(JSON.stringify(constantTableData));
    copy.SUITES_DESIGNATOR.value = item.defaultTableData.SUITES_DESIGNATOR;
    const actualExitCode = copy.TEST_SUITE_EXIT_CODE.value = item.actualExitCode;

    var obj;
    if (tableDataFromCP) {

      Object.keys(tableDataFromCP).forEach(function (key) {
        const val = tableDataFromCP[key];
        if (copy[key] && !copy[key].value) {  //if value is not already set
          copy[key].value = val;
        }
      });

      if (actualExitCode === 0) {
        totals.suitesPassed++;
      }
      else {
        totals.suitesFailed++;
      }

      totals.testsPassed += tableDataFromCP.TEST_CASES_PASSED;
      totals.testsFailed += tableDataFromCP.TEST_CASES_FAILED;
      totals.testsSkipped += tableDataFromCP.TEST_CASES_SKIPPED;
      totals.testsStubbed += tableDataFromCP.TEST_CASES_STUBBED;
      totals.allTests += tableDataFromCP.TEST_CASES_TOTAL;

      obj = mapCopy(copy);

      if (global.sumanOpts.sort_by_millis) {
        storeRowsHereIfUserWantsSortedData.push(copy);
      }

      table1.addRow.apply(table1, obj);
    }
    else {

      obj = mapCopy(copy);

      if (global.sumanOpts.sort_by_millis) {
        storeRowsHereIfUserWantsSortedData.push(copy);
      }

      totals.suitesFailed++; //TODO: possible that table data was not received, but exit code was still 0?
      table1.addRow.apply(table1, obj);
    }

  });

  var str1 = table1.toString();
  str1 = '\t' + str1;
  resultBroadcaster.emit(events.RUNNER_RESULTS_TABLE, '\n\n' + str1.replace(/\n/g, '\n\t') + '\n\n');

  if (global.sumanOpts.sort_by_millis) {

    const tableSortedByMillis = new AsciiTable('Suman Runner Results - sorted by millis');

    tableSortedByMillis.setHeading.apply(tableSortedByMillis, Object.keys(constantTableData).map(key => constantTableData[key].name));

    _.sortBy(storeRowsHereIfUserWantsSortedData, function (item) {
      return item.TEST_FILE_MILLIS.value;
    }).map(function (item) {
      return mapCopy(item);
    }).forEach(function (obj) {
      tableSortedByMillis.addRow.apply(tableSortedByMillis, obj);
    });

    var strSorted = tableSortedByMillis.toString();
    strSorted = '\t' + strSorted;
    console.log(strSorted.replace(/\n/g, '\n\t'));
    resultBroadcaster.emit(events.RUNNER_RESULTS_TABLE_SORTED_BY_MILLIS,
      '\n\n' + str2.replace(/\n/g, '\n\t') + '\n\n');

  }

  table2.setHeading('Totals =>', 'Bailed?', 'Files Passed', 'Files Failed', 'Tests Passed',
    'Tests Failed', 'Tests Skipped', 'Tests Stubbed', 'All Tests', 'Total Time');
  table2.addRow(Object.keys(totals).map(key => totals[key]));

  console.log('\n');
  var str2 = table2.toString();
  str2 = '\t' + str2;
  resultBroadcaster.emit(events.RUNNER_OVERALL_RESULTS_TABLE, str2.replace(/\n/g, '\n\t') + '\n\n');

  async.parallel([
      function (cb) {

        if (true) {
          process.nextTick(cb);
        }
        else {
          finalizeOutput(function (err) {
            if (err) {
              console.error(err.stack || err);
            }
            cb(null);
          });
        }

      }
    ],

    function complete(err, results) {
      process.exit(exitCode);
    });

}

const oncePosts = {};
var oncePostModuleRet = null;
var hasOncePostFile = false;
const allOncePostKeys = [];
var innited = false;

function handleIntegrantInfo(msg, n) {

  const oncePostKeys = msg.oncePost;

  if (Number.isInteger(msg.expectedExitCode)) {
    n.expectedExitCode = msg.expectedExitCode;
  }
  else if (msg.expectedExitCode !== undefined) {
    throw new Error(' => Suman implementation error => expected exit code not an integer ' +
      'for child process => ' + n.testPath);
  }

  if (Number.isInteger(msg.expectedTimeout)) {
    if (!weAreDebugging) {
      clearTimeout(n.to);
      n.to = setTimeout(function () {
        n.kill();
      }, msg.expectedTimeout);
    }

  }
  else if (msg.expectedTimeout !== undefined) {
    throw new Error(' => Suman implementation error => expected timeout not an acceptable integer ' +
      'for child process => ' + n.testPath);
  }

  //we want send back onlyPosts immediately because if we wait it blocks unnecessarily

  assert(Array.isArray(oncePostKeys), 'oncePostKeys is not an array type.');
  allOncePostKeys.push(oncePostKeys);

  if (process.env.SUMAN_DEBUG === 'yes') {
    console.log('\n', ' => Recevied integrant info msg =>', util.inspect(msg), '\nfrom testPath => ', n.testPath, '\n');
  }

  process.nextTick(function () {
    n.send({
      info: 'once-post-received'
    });
  });

  if (oncePostKeys.length > 0 && !innited) {
    try {
      innited = true; //we only want to run this logic once
      oncePostModule = require(path.resolve(global.sumanHelperDirRoot + '/suman.once.post.js'));
      assert(typeof  oncePostModule === 'function', 'suman.once.post.js module does not export a function.');
      hasOncePostFile = true;
    }
    catch (err) {
      console.error(colors.red(' => Suman usage warning => you have suman.once.post data defined, ' +
          'but no suman.once.post.js file.') + '\n' + (err.stack || err));
    }

  }

  const integrants = msg.msg;

  if (process.env.SUMAN_DEBUG === 'yes') {
    console.log('\n', ' => integrants received =>', util.inspect(msg), '\n\n');
  }

  integrants.forEach(function (intg) {

    if (!(String(intg) in integrantHash)) {
      if (process.env.SUMAN_DEBUG === 'yes') {
        console.log(' => intg with key ="' + String(intg) + '" is not in integrantHash => ', Object.keys(integrantHash));
      }
      integrantHash[String(intg)] = [];
      integrantHash[String(intg)].push(n);   //store cps in hash, with integrant names as keys
      verifyIntegrant(intg);
    }
    else if (String(integrantHash[intg]).toUpperCase() === 'READY') {

      if (process.env.SUMAN_DEBUG === 'yes') {
        console.log(' => integrants READY =>', util.inspect(msg));
      }

      n.send({info: 'integrant-ready', data: intg, val: integrantHashKeyValsForSumanOncePost[intg]});
    }
    else if (integrantHash[intg] instanceof Error) {

      if (process.env.SUMAN_DEBUG === 'yes') {
        console.log(' => integrants error =>', util.inspect(integrantHash[intg]));
      }

      n.send({info: 'integrant-error', data: integrantHash[intg].stack});
    }
    else if (Array.isArray(integrantHash[intg])) {

      if (process.env.SUMAN_DEBUG === 'yes') {
        console.log('\n', ' => child process with filePath =>', n.testPath, '\n is being push to integrants array value for key =>', intg);
      }

      integrantHash[intg].push(n);

      if (process.env.SUMAN_DEBUG === 'yes') {

        console.log('\n', 'integrantHash for key = "' + intg + '", looks like => \n',
          integrantHash[intg].map(cp => 'cp with testPath =>' + cp.testPath))
      }
    }
    else {
      throw new Error('Unknown state of integrant readiness for integrant key => "' + intg + '",\n\n => ' + util.inspect(integrantHash));
    }

  });

}

const callbackOrPromise = require('./callback-or-promise');

function beforeExitRunOncePost(cb) {

  if (!hasOncePostFile) {
    return process.nextTick(cb);
  }

  const flattenedAllOncePostKeys = _.uniq(_.flatten(allOncePostKeys));

  if (sumanUtils.isSumanDebug()) {
    console.error('integrantHashKeyValsForSumanOncePost =>', util.inspect(integrantHashKeyValsForSumanOncePost));
  }
  userData['suman.once.pre.js'] = integrantHashKeyValsForSumanOncePost;
  const oncePostModuleRet = oncePostModule.apply(null, [userData]);

  flattenedAllOncePostKeys.forEach(function (k) {
    //we store an integer for analysis/program verification, but only really need to store a boolean
    //for existing keys we increment by one, otherwise assign to 1
    oncePosts[k] = oncePosts[k] || oncePostModuleRet[k];

    if (typeof oncePosts[k] !== 'function') {

      console.log(' => Suman is about to conk out =>\n\n' +
        ' => here is the contents return by the exported function in suman.once.post.js =>\n\n', oncePosts);

      throw new Error('\n' + colors.red(' => Suman usage warning => your suman.once.post.js ' +
          'has keys whose values are not functions,\n\nthis applies to key ="' + k + '"'));

    }
  });

  console.log('\n\n\n', ' => Suman message => All child processes exited.\n');

  const keys = Object.keys(oncePosts);
  if (keys.length) {
    console.log('\n', ' => Suman message => Suman is now running the desired hooks in suman.once.post.js, which include => \n\t', colors.cyan(util.inspect(keys)));
  }

  async.eachSeries(keys, function (k, cb) {

    callbackOrPromise(k, oncePosts, cb);

  }, function (err) {
    if (err) {
      console.error(err.stack || err);
      cb(err);
    }
    else {
      console.log('\n\n', ' => Suman message => all suman.once.post.js hooks completed successfully...exiting...\n\n', '\n\n');
      process.nextTick(function () {
        cb(null);
      });
    }
  });

}

function handleFatalMessage(msg, n) {

  var foo = String(typeof msg.error === 'string' ? msg.error : util.inspect(msg)).replace(/\n/g, '\n').replace('\t', '');

  foo = foo.split('\n').map(function (item, index) {
    if (index === 0) {
      return item;
    }
    else {
      return sumanUtils.padWithXSpaces(8) + item;
    }

  }).join('\n');

  const message = [
    '\n',
    colors.bgMagenta.white.bold(' => Suman runner => there was a fatal test suite error - an error was encountered in your test code that prevents Suman'),
    colors.bgMagenta.white.bold(' from continuing with a particular test suite within the following path:'),
    ' ',
    colors.bgWhite.black.bold(' => ' + n.testPath + ' '),
    ' ', //colors.bgBlack.white(' '),
    (function () {
      if (!global.sumanOpts.sparse) {
        return colors.grey('(note that despite this fatal error, other test processes will continue running, as would be expected, use the ' + colors.cyan('--bail') + ' option, if you wish otherwise.)');
      }
      return null;
    })(),
    ' ', //colors.bgBlack.white(' '),
    colors.magenta.bold(foo),
    // colors.magenta.bold(String(msg.error ? msg.error : JSON.stringify(msg)).replace(/\n/g, '\n\t')),
    '\n\n'
  ].filter(item => item).join('\n\t'); //filter out null/undefined

  resultBroadcaster.emit(events.FATAL_TEST_ERROR, message);
}

function verifyIntegrant(intg) {

  const d = domain.create();

  d.once('error', function (err) {

    console.log(err.stack || err);
    const cps = integrantHash[intg];

    integrantHash[intg] = err;

    console.log(!Array.isArray(cps) ? '\n => for intg ="' + intg + '", cps in error => ' + util.inspect(cps) : '');

    cps.forEach(function (cp) {
      // TODO cps does not seem to be an array here
      cp.send({info: 'integrant-error', data: err});
    });

    throw new Error(' => Suman usage error in suman.once.js for key => "' + intg + '"\n' + (err.stack || err));
  });

  var callable = true;

  function sendOutMsg(val) {

    if (!callable) {
      //make sure this function is only called once per intg key
      console.error(' => Suman usage warning in your suman.once.js file => \n' +
        '=> callback was fired twice for key = "' + intg + '"');
      return;
    }

    callable = false;
    const cps = integrantHash[intg];

    if (process.env.SUMAN_DEBUG === 'yes') {
      console.log(!Array.isArray(cps) ? '\n => for intg ="' + intg + '", cps => ' + util.inspect(cps) : '');
    }

    integrantHash[intg] = 'READY';
    integrantHashKeyValsForSumanOncePost[intg] = val;

    if (sumanUtils.isSumanDebug()) {
      console.log(' => sending out READY message for integrant = "' + intg + '" to the following cps => \n', cps.map(function (cp) {
        return cp.testPath;
      }), '\n\n');
    }

    cps.forEach(function (cp) {
      cp.send({info: 'integrant-ready', data: intg, val: val});
    });

  }

  d.run(function () {
    process.nextTick(function () {
      const fn = depContainerObj[intg];
      assert(typeof fn === 'function', 'Integrant listing is not a function => ' + intg);
      if (fn.length > 0) {
        fn.apply(global, [function (err, val) {
          if (err) {
            //TODO: fix this, need to handle error properly
            console.error(err.stack || err);
            d.emit('error', err);
          }
          else {
            // TODO: assert that value has been serialized (string, number, boolean, etc)
            sumanUtils.runAssertionToCheckForSerialization(val);
            sendOutMsg(val);
          }
        }]);
      }
      else {
        Promise.resolve(fn.apply(global, [])).then(function (val) {
          // TODO: assert that value has been serialized (string, number, boolean, etc)
          sumanUtils.runAssertionToCheckForSerialization(val);
          sendOutMsg(val);
        }, function (err) {
          console.error(err.stack || err);
          d.emit('error', err);
        });
      }
    });
  });
}

function handleMessageForSingleProcess(msg, n) {

  if (listening) {

    switch (msg.type) {

      case constants.runner_message_type.TABLE_DATA:
        // handleTableData(n, msg.data);
        break;

      //TODO: shouldn't integrants for single process be handled differently than multi-process?
      case constants.runner_message_type.INTEGRANT_INFO:
        handleIntegrantInfo(msg, n);
        break;
      case constants.runner_message_type.LOG_DATA:
        logTestData(msg);
        break;
      case constants.runner_message_type.LOG_RESULT:
        logTestResult(msg, n);
        break;
      case constants.runner_message_type.FATAL_SOFT:
        console.error('\n\n' + colors.grey(' => Suman warning => ') + colors.magenta(msg.msg) + '\n');
        break;
      case constants.runner_message_type.FATAL:
        n.send({info:'fatal-message-received'});
        //TODO: need to make sure this is only called once per file
        handleFatalMessage(msg.data, n);
        break;
      case constants.runner_message_type.WARNING:
        console.error('\n\n ' + colors.bgYellow('Suman warning: ' + msg.msg + '\n'));
        break;
      case constants.runner_message_type.NON_FATAL_ERR:
        console.error('\n\n ' + colors.red('non-fatal suite error: ' + msg.msg + '\n'));
        break;
      case constants.runner_message_type.CONSOLE_LOG:
        console.log(msg.msg);
        break;
      case constants.runner_message_type.MAX_MEMORY:
        console.log('\nmax memory: ' + util.inspect(msg.msg));
        break;
      default:
        throw new Error(' => Suman internal error => bad msg.type in runner');
    }

  }
  else {
    throw new Error('Suman internal error => this definitely shouldn\'t happen');
  }
}

function handleMessage(msg, n) {

  if (listening) {

    switch (msg.type) {

      case constants.runner_message_type.TABLE_DATA:
        handleTableData(n, msg.data);
        break;
      case constants.runner_message_type.INTEGRANT_INFO:
        handleIntegrantInfo(msg, n);
        break;
      case constants.runner_message_type.LOG_DATA:
        logTestData(msg);
        break;
      case constants.runner_message_type.LOG_RESULT:
        logTestResult(msg, n);
        break;
      case constants.runner_message_type.FATAL_SOFT:
        console.error('\n\n' + colors.grey(' => Suman warning => ') + colors.magenta(msg.msg) + '\n');
        break;
      case constants.runner_message_type.FATAL:
        n.send({info:'fatal-message-received'});
        //TODO: need to make sure this is only called once per file
        //TODO: https://www.dropbox.com/s/qbak4a9bgml31jx/Screenshot%202016-04-09%2017.20.57.png?dl=0
        handleFatalMessage(msg.data, n);
        break;
      case constants.runner_message_type.WARNING:
        console.error('\n\n ' + colors.bgYellow('Suman warning: ' + msg.msg + '\n'));
        break;
      case constants.runner_message_type.NON_FATAL_ERR:
        console.error('\n\n ' + colors.red('non-fatal suite error: ' + msg.msg + '\n'));
        break;
      case constants.runner_message_type.CONSOLE_LOG:
        console.log(msg.msg);
        break;
      case constants.runner_message_type.MAX_MEMORY:
        console.log('\n => Max memory: ' + util.inspect(msg.msg));
        break;
      default:
        throw new Error(' => Suman implementation error => Bad msg.type in runner, perhaps the user sent a message with process.send?');
    }

  }
  else {
    throw new Error(' => Suman implementation error => this definitely shouldn\'t happen, please report.');
  }
}


function runAllTestsInSingleProcess(runObj) {

  const args = [];

  //handle if dirs is not an array
  // var files = getFilePaths(_.flattenDeep([dirs]));

  // files = _.flattenDeep([files]);

  var files = runObj.files;

  if (global.sumanOpts.rand) {
    files = _.shuffle(files);
  }

  const $files = sumanUtils.removeSharedRootPath(files);
  const SUMAN_SINGLE_PROCESS_FILES = JSON.stringify($files);

  const toPrint = $files.map(function (f) {
    return ' => ' + f[1];
  });

  toPrint.unshift('');
  toPrint.push('');
  toPrint.push('');
  toPrint.push('');  // add some vertical padding

  console.log(' => Suman files running in single process =>\n', toPrint.join('\n\t'));
  startTime = Date.now();

  const sumanEnv = Object.assign({}, process.env, {
    SUMAN_CONFIG: JSON.stringify(global.sumanConfig),
    SUMAN_OPTS: JSON.stringify(global.sumanOpts),
    SUMAN_SINGLE_PROCESS_FILES: SUMAN_SINGLE_PROCESS_FILES,
    SUMAN_SINGLE_PROCESS: 'yes',
    SUMAN_RUNNER: 'yes',
    SUMAN_RUNNER_TIMESTAMP: timestamp,
    NPM_COLORS: process.env.NPM_COLORS || (global.sumanOpts.no_colors ? 'no' : 'yes')
  });

  if (global.sumanOpts.register) {
    args.push('--register');
  }

  const execArgz = ['--expose-gc', '--harmony', '--expose_debug_as=v8debug'];

  if (weAreDebugging) {
    if (!global.sumanOpts.ignore_break) {  //NOTE: this allows us to focus on debugging runner
      execArgz.push('--debug-brk');
    }
    execArgz.push('--debug=' + (5303 + processId++));
  }

  const ext = _.merge({}, {
    cwd: projectRoot,  //TODO: improve this logic
    silent: !(global.sumanOpts.no_silent === true),
    execArgv: execArgz,
    env: sumanEnv,
    // uid: gid++,
    detached: false   //TODO: detached:false works but not true
  });

  const n = cp.fork(path.resolve(__dirname + '/run-child.js'), args, ext);

  //TODO: n.testPath is not defined, have to mititage this so that logic still works

  n.on('message', function (msg) {
    handleMessageForSingleProcess(msg, n);
  });

  n.on('error', function (err) {
    throw new Error(err.stack);
  });

  if (global.sumanOpts.no_silent !== true) {

    n.stdio[2].setEncoding('utf-8');
    // n.stdio[2].pipe(global.sumanStderrStream);
    n.stdio[2].on('data', function (data) {

      const d = String(data).split('\n').map(function (line) {
        return '[' + '???' + '] ' + line;
      }).join('\n');

      global.sumanStderrStream.write('\n\n');
      global.sumanStderrStream.write(d);

      if (weAreDebugging) {  //TODO: add check for NODE_ENV=dev_local_debug
        //TODO: go through code and make sure that no console.log statements should in fact be console.error
        console.log('pid => ', n.pid, 'stderr => ', d);
      }

    });

  }

  n.on('exit', function (code, signal) {

    if (process.env.SUMAN_DEBUG === 'yes') {
      console.log('\n', colors.black.bgYellow(' => process given by => ' + n.shortTestPath + ' exited with code: ' + code + ' '), '\n');
    }

    if (process.env.SUMAN_DEBUG === 'yes') {
      global.timeOfMostRecentExit = Date.now();
    }

    n.removeAllListeners();

    doneCount++;
    messages.push({code: code, signal: signal});
    // tableRows[n.shortTestPath].actualExitCode = code;

    //TODO: if bail, need to make that clear to user here

    listening = false;
    setImmediate(function () {
      beforeExitRunOncePost(function (err) {
        makeExit(messages, Date.now() - startTime);
      });
    });

  });

}

function runSingleOrMultipleDirs(runObj) {

  const args = [];

  if (global.usingLiveSumanServer) {
    args.push('--live_suman_server');
  }

  var files = runObj.files;
  const filesThatDidNotMatch = runObj.filesThatDidNotMatch;

  filesThatDidNotMatch.forEach(function (val) {
    console.log('\n', colors.bgBlack.yellow(' => Suman message =>  A file in a relevant directory ' +
      'did not match your regular expressions => '), '\n', util.inspect(val));
  });

  //TODO: need to remove duplicate files before calling resultBroadcaster
  resultBroadcaster.emit(events.RUNNER_STARTED, files.length);


  if (global.sumanOpts.rand) {
    files = _.shuffle(files);
  }

  //TODO: need to make sure list of files is unique list, if not report that as non-fatal error

  handleBlocking.determineInitialStarters(files);
  startTime = Date.now();

  const fileObjArray = sumanUtils.removeSharedRootPath(files);

  const sumanEnv = Object.assign({}, process.env, {
    SUMAN_CONFIG: JSON.stringify(global.sumanConfig),
    SUMAN_OPTS: JSON.stringify(global.sumanOpts),
    SUMAN_RUNNER: 'yes',
    SUMAN_RUNNER_TIMESTAMP: timestamp,
    NPM_COLORS: process.env.NPM_COLORS || (global.sumanOpts.no_color ? 'no' : 'yes')
  });

  const execFile = path.resolve(__dirname + '/run-child.js');

  fileObjArray.forEach(function (fileShortAndFull, index) {

    const file = fileShortAndFull[0];
    const shortFile = fileShortAndFull[1];

    // const basename = path.basename(file);

    var basename = file.length > 28 ? ' ' + String(file).substring(Math.max(0, file.length - 28)) + ' ' : file;

    const m = String(basename).match(/\//g);

    if (m && m.length > 1) {
      const arr = String(basename).split('');
      var i = 0;
      while (arr[i] !== '/') {
        arr.shift();
      }
      basename = arr.join('');
    }

    tableRows[shortFile] = {
      actualExitCode: null,
      shortFilePath: shortFile,
      tableData: null,
      defaultTableData: {
        SUITES_DESIGNATOR: basename
      }
    };

    const argz = JSON.parse(JSON.stringify(args));


    function run() {

      const execArgz = ['--expose-gc', '--harmony'];

      if (weAreDebugging) {
        if (!global.sumanOpts.ignore_break) {  //NOTE: this allows us to focus on debugging runner
          execArgz.push('--debug-brk');
        }
        execArgz.push('--debug=' + (5303 + processId++));
      }

      const ext = _.merge({env: {SUMAN_CHILD_TEST_PATH: file}}, {
        cwd: global.sumanOpts.force_cwd_to_be_project_root ? projectRoot : path.dirname(file),  //TODO: improve this logic
        // silent: !(global.sumanOpts.no_silent === true),
        // silent: false,
        // stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        execArgv: execArgz,
        env: sumanEnv,
        detached: false   //TODO: detached:false works but not true
      });

      var n;

      const extname = path.extname(shortFile);

      if (global.sumanOpts.library_coverage) {
        console.log(' => Running library coverage with Istanbul for index => ' + index + ' file => ' + shortFile);
        const coverageDir = path.resolve(global.projectRoot + '/coverage/runner+' + String(shortFile).replace(/\//g, '-'));
        n = cp.spawn('istanbul', ['cover', execFile, '--dir', coverageDir, '--'].concat(args), ext);
      }
      else if ('.js' === extname) {

        // n = cp.fork(execFile, argz, ext);
        argz.unshift(execFile);
        n = cp.spawn('node', argz, ext);
      }
      // else if('.sh'  === extname){
      //   argz.unshift(file);
      //   console.log('args => ', argz);
      //   n = cp.spawn('exec', argz, ext);
      // }
      else if ('.sh' === extname) {
        // we run the file directly, hopefully it has a hashbang
        n = cp.spawn(file, argz, ext);
      }
      else if ('.bash' === extname) {
        argz.unshift(file);
        n = cp.spawn('bash', argz, ext);
      }
      else {
        throw new Error(' => File with that extension is not yet supported by the Suman test runner => ' + shortFile);
      }

      if (!weAreDebugging) {
        n.to = setTimeout(function () {
          n.kill('SIGKILL');
        }, 60000);
      }

      n.testPath = file;
      n.shortTestPath = shortFile;

      forkedCPs.push(n);

      n.on('message', function (msg) {
        handleMessage(msg, n);
      });

      n.send({dogs: 'rus'});

      n.on('error', function (err) {
        console.error('\n', err.stack || err, '\n');
      });

      if (n.stdio /*false && global.sumanOpts.no_silent !== true*/) {

        n.stdio[2].setEncoding('utf-8');
        n.stdio[2].on('data', function (data) {

          const d = String(data).split('\n').filter(function (line) {
            return String(line).length;
          }).map(function (line) {
            return '[' + n.shortTestPath + '] ' + line;
          }).join('\n\n');

          global.sumanStderrStream.write('\n\n');
          global.sumanStderrStream.write(d);

          if (weAreDebugging) {  //TODO: add check for NODE_ENV=dev_local_debug
            //TODO: go through code and make sure that no console.log statements should in fact be console.error
            console.log('pid => ', n.pid, 'stderr => ', d);
          }

        });

      }

      n.on('exit', function (code, signal) {

        resultBroadcaster.emit(events.TEST_FILE_CHILD_PROCESS_EXITED, {
          testPath: n.testPath,
          exitCode: code
        });

        if (process.env.SUMAN_DEBUG === 'yes') {
          console.log('\n', colors.black.bgYellow(' => process given by => ' + n.shortTestPath + ' exited with code: ' + code + ' '), '\n');
        }

        if (process.env.SUMAN_DEBUG === 'yes') {
          global.timeOfMostRecentExit = Date.now();
        }

        n.removeAllListeners();

        const originalExitCode = JSON.parse(JSON.stringify(code));

        if (n.expectedExitCode !== undefined) {
          if (code === n.expectedExitCode) {
            code = 0;
          }
          // else{  // do not need this because child process should handle this
          //    code = constants.EXIT_CODES.EXPECTED_EXIT_CODE_NOT_MET;
          // }
        }

        doneCount++;
        messages.push({code: code, signal: signal});
        tableRows[n.shortTestPath].actualExitCode = n.expectedExitCode !== undefined ?
        n.expectedExitCode + '/' + originalExitCode : originalExitCode;

        //TODO: if bail, need to make that clear to user here
        if ((bailed = (code > 0 && global.sumanOpts.bail)) || (doneCount >= forkedCPs.length && queuedCpsObj.queuedCPs.length < 1)) {
          endTime = Date.now();
          listening = false;
          setImmediate(function () {
            beforeExitRunOncePost(function (err) {
              makeExit(messages, endTime - startTime);
            });
          });
        }
        else {
          const testPath = n.testPath;
          handleBlocking.releaseNextTests(testPath, queuedCpsObj);
          if (process.env.SUMAN_DEBUG === 'yes') {
            console.log(' => Time required to release next test(s) => ', Date.now() - global.timeOfMostRecentExit, 'ms');
          }
        }
      });

    }

    run.testPath = file;
    run.shortTestPath = shortFile;

    if (handleBlocking.shouldFileBeBlockedAtStart(file)) {
      queuedCpsObj.queuedCPs.push(run);
      // argz.push('--blocked');
      if (process.env.SUMAN_DEBUG == 'on') {
        console.log('File is blocked =>', file);
      }
    }
    else {
      run();
      if (process.env.SUMAN_DEBUG == 'on') {
        console.log('File is running =>', file);
      }
    }

  });

  if (forkedCPs.length < 1 && queuedCpsObj.queuedCPs.length > 0) {
    throw new Error(' => Suman internal error => fatal start order algorithm error, please file an issue on Github, thanks.');
  }

  if (forkedCPs.length < 1) {
    noFilesFoundError(files);
  }
  else {
    const totalCount = forkedCPs.length + queuedCpsObj.queuedCPs.length;
    var suites = totalCount === 1 ? 'suite' : 'suites';
    var processes = totalCount === 1 ? 'process' : 'processes';

    //TODO: add info to demonstrate initial set running, vs total set that will be run
    //TODO: only show extra info if necessary

    resultBroadcaster.emit(events.RUNNER_INITIAL_SET,
      '\n\n\t ' + colors.bgBlue.yellow(' => [Suman runner] =>  initial set => ' +
        forkedCPs.length + ' ' + processes + ' running ' + forkedCPs.length + ' ' + suites + ' ') + '\n');

    const addendum = maxProcs < totalCount ? ' with no more than ' + maxProcs + ' running at a time.' : '';

    resultBroadcaster.emit(events.RUNNER_OVERALL_SET,
      '\t ' + colors.bgBlue.yellow(' => [Suman runner] =>  overall set => '
        + totalCount + ' ' + processes + ' will run ' + totalCount + ' ' + suites + addendum + ' ') + '\n\n\n');

  }

  if (global.sumanOpts.errors_only) {
    console.log('\n', colors.bgGreen.white.bold(' => ' + colors.white.bold('"--errors-only"')
      + ' option used, hopefully you don\'t see much output until the end :) '), '\n');
  }

}

function findTestsAndRunThem(runObj, runOnce, $order) {

  debugger; // leave it here

  //need to get rid of this property so child processes cannot require Suman index file
  delete process.env.SUMAN_EXTRANEOUS_EXECUTABLE;

  handleBlocking = makeHandleBlocking(_.mapValues($order, function (val) {
    val.testPath = path.resolve(projectRoot + '/' + val.testPath);
    return val;
  }));


  process.nextTick(function () {

    depContainerObj = runOnce();  //TODO: should this be done  before this point in the program?
    resultBroadcaster.emit(events.RUNNER_ASCII_LOGO, '\n\n' + ascii.suman_runner + '\n\n');

    if (process.env.SUMAN_SINGLE_PROCESS === 'yes') {
      runAllTestsInSingleProcess(runObj);
    }
    else if (runObj) {
      runSingleOrMultipleDirs(runObj);
    }
    else {
      throw new Error(' => Suman implementation error => Please report.');
    }

  });

}

module.exports = findTestsAndRunThem;


