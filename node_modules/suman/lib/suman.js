'use striiiict';

//core
const fs = require('fs');
const path = require('path');
const domain = require('domain');
const EE = require('events');
const util = require('util');

//npm
const _ = require('lodash');
const readline = require('readline');
const colors = require('colors/safe');
const AsciiTable = require('ascii-table');
const async = require('async');
const fnArgs = require('function-arguments');
const a8b = require('ansi-256-colors'), fg = a8b.fg, bg = a8b.bg;
const events = require('suman-events');

//project
const sumanUtils = require('suman-utils/utils');
const finalizeOutput = require('./helpers/finalize-output');
const findSumanServer = require('./find-suman-server');
const constants = require('../config/suman-constants');

///////////////////////// debugging ///////////////////////////////////////////

const weAreDebugging = require('./helpers/we-are-debugging');

///////////////////////////////////////////////////////////////////////////////////////

function Suman(obj) {
  //initialize via options
  this.interface = obj.interface;
  this.fileName = obj.fileName;
  this.networkLog = obj.networkLog;
  this.outputPath = obj.outputPath;
  this.timestamp = obj.timestamp;
  this.sumanId = ++global.sumanId;

  // initialize
  this.allDescribeBlocks = [];
  this.describeOnlyIsTriggered = false;
  this.deps = null;
  this.numHooksSkipped = 0;
  this.numHooksStubbed = 0;
  this.numBlocksSkipped = 0;
}

Suman.prototype._makeExit = function (exitCode) { //TODO this should just be in the on('exit) handler!!

  //unused legacy code

  finalizeOutput(function (err) {
    if (err) {
      process.stdout.write(err.stack);
    }
    process.exit(exitCode);  //TODO does this produce the proper exit code?
  });

};

Suman.prototype.log = function (userInput, test) {

  var self = this;

  var data = {
    type: 'USER_LOG',
    userOutput: true,
    testId: test.testId,
    data: userInput,
    outputPath: self.outputPath
  };

  if (process.send) {
    //process.send(data);
  }
  else {

    var json;
    if (this.usingLiveSumanServer) {
      json = JSON.stringify(data);
      fs.appendFileSync(this.outputPath, json += ',');
      // this.networkLog.sendTestData(data);
    }
    else if (this.outputPath) {
      json = JSON.stringify(data);
      fs.appendFileSync(this.outputPath, json += ',');
    }
    else {

      console.log(new Error('Suman cannot log your test result data:\n').stack);
      //try {
      //    var pth = path.resolve(sumanUtils.getHomeDir() + '/suman_results')
      //    json = JSON.stringify(data);
      //    fs.appendFileSync(pth, json += ',');
      //}
      //catch (err) {
      //    console.error('Suman cannot log your test result data:\n' + err.stack);
      //}
    }
  }
};

Suman.prototype.logFatalSuite = function logFatalSuite(test) {

  const data = {
    'FATAL': {
      testId: test.testId
    }

  };

  if (global.usingRunner) {
    //TODO: need to send log_data to runner so that writing to same file doesn't get corrupted? or can we avoid this if only this process writes to the file?
    //process.send(data);
  }
  else {

    if (this.usingLiveSumanServer) {
      //TODO: we may want to log locally first just to make sure we have the data somewhere
      this.networkLog.sendTestData(data);
    }
    else if (this.outputPath) {
      var json = JSON.stringify(data.test);
      fs.writeFileSync(this.outputPath, '');
    }
    else {
      console.log(new Error('Suman cannot log your test result data:\n').stack);
      //try {
      //    var pth = path.resolve(sumanUtils.getHomeDir() + '/suman_results');
      //    json = JSON.stringify(data);
      //    fs.appendFileSync(pth, json += ',');
      //}
      //catch (err) {
      //    console.error('Suman cannot log your test result data:\n' + err.stack);
      //}

    }
  }
};

Suman.prototype.getTableData = function () {

};

Suman.prototype.logFinished = function ($exitCode, skippedString, cb) {

  //note: if $exitCode is defined, it should be > 0

  var exitCode = $exitCode || 999; //in case of future fall through

  // const desc = this.allDescribeBlocks[ 0 ] ? this.allDescribeBlocks[ 0 ].desc : '[unknown suite description]';
  const desc = this.rootSuiteDescription;
  const suiteName = desc.length > 50 ? '...' + desc.substring(desc.length - 50, desc.length) : desc;
  const suiteNameShortened = desc.length > 15 ? desc.substring(0, 12) + '...' : desc;
  var delta = this.dateSuiteFinished - this.dateSuiteStarted;

  const skippedSuiteNames = [];
  var suitesTotal = null;
  var suitesSkipped = null;
  var testsSkipped = null;
  var testsStubbed = null;
  var testsPassed = null;
  var testsFailed = null;
  var totalTests = null;

  var completionMessage = ' (implementation error, please report) ';

  if ($exitCode === 0 && skippedString) {
    completionMessage = '(Test suite was skipped)';
    exitCode = 0;
  }
  else if ($exitCode === 0 && !skippedString) {

    completionMessage = 'Ran to completion';

    suitesTotal = this.allDescribeBlocks.length;

    suitesSkipped = this.allDescribeBlocks.filter(function (block) {
      if (block.skipped || block.skippedDueToOnly) {
        skippedSuiteNames.push(block.desc);
        return true;
      }
    }).length;

    if (suitesSkipped.length) {
      console.log(' => Suman implementation warning => suites skipped was non-zero outside of suman.numBlocksSkipped value.');
    }

    suitesSkipped += this.numBlocksSkipped;

    testsSkipped = this.allDescribeBlocks.map(function (block) {
      if (block.skipped || block.skippedDueToOnly) {
        return block.getParallelTests().concat(block.getTests()).length;
      }
      else {
        return block.getParallelTests().concat(block.getTests()).filter(function (test) {
          return test.skipped || test.skippedDueToOnly;
        }).length;
      }

    }).reduce(function (prev, current) {
      return prev + current;
    });

    testsStubbed = this.allDescribeBlocks.map(function (block) {

      return block.getParallelTests().concat(block.getTests()).filter(function (test) {
        return test.stubbed;
      }).length;

    }).reduce(function (prev, current) {
      return prev + current;
    });

    testsPassed = this.allDescribeBlocks.map(function (block) {
      if (block.skipped || block.skippedDueToOnly) {
        return 0;
      }
      else {
        return block.getParallelTests().concat(block.getTests()).filter(function (test) {
          return !test.skipped && !test.skippedDueToOnly && test.error == null && test.complete === true;
        }).length;
      }

    }).reduce(function (prev, current) {
      return prev + current;
    });

    testsFailed = this.allDescribeBlocks.map(function (block) {
      if (block.skipped || block.skippedDueToOnly) {
        return 0;
      }
      else {
        return block.getParallelTests().concat(block.getTests()).filter(function (test) {
          return !test.skipped && !test.skippedDueToOnly && test.error != null;
        }).length;
      }
    }).reduce(function (prev, current) {
      return prev + current;
    });

    totalTests = this.allDescribeBlocks.map(function (block) {

      return block.getParallelTests().concat(block.getTests()).length;

    }).reduce(function (prev, current) {
      return prev + current;
    });

    if (testsFailed > 0) {
      exitCode = constants.EXIT_CODES.TEST_CASE_FAIL;
    }
    else {
      exitCode = constants.EXIT_CODES.SUCCESSFUL_RUN;
    }

  }
  else {
    completionMessage = ' Test file errored out.';
  }

  delta = (typeof delta === 'number' && !Number.isNaN(delta)) ? delta : 'N/A';
  const deltaMinutes = (typeof delta === 'number' && !Number.isNaN(delta)) ? Number(delta / (1000 * 60)).toFixed(4) : 'N/A';
  const passingRate = (typeof testsPassed === 'number' && typeof totalTests === 'number' && totalTests > 0) ?
  Number(100 * (testsPassed / totalTests)).toFixed(2) + '%' : 'N/A';

  if (global.usingRunner) {

    const d = {};
    d.ROOT_SUITE_NAME = suiteNameShortened;
    d.SUITE_COUNT = suitesTotal;
    d.SUITE_SKIPPED_COUNT = suitesSkipped;
    d.TEST_CASES_TOTAL = totalTests;
    d.TEST_CASES_FAILED = testsFailed;
    d.TEST_CASES_PASSED = testsPassed;
    d.TEST_CASES_SKIPPED = testsSkipped;
    d.TEST_CASES_STUBBED = testsStubbed;
    d.TEST_SUITE_MILLIS = delta;
    d.OVERALL_DESIGNATOR = 'received';

    process.nextTick(function () {
      cb(null, {
        exitCode: exitCode,
        tableData: d
      })
    });

  }
  else {

    const table = new AsciiTable('Results for: ' + suiteName);
    table.setHeading('Metric', '    Value   ', '    Comments   ');

    if (skippedString) {
      table.addRow('Status', completionMessage, skippedString);
    }
    else {
      table.addRow('Status', completionMessage, '            ');
      table.addRow('Num. of Unskipped Test Blocks', suitesTotal, '');

      table.addRow('Test blocks skipped', suitesSkipped ? 'At least ' + suitesSkipped : '-',
        skippedSuiteNames.length > 0 ? JSON.stringify(skippedSuiteNames) : '');

      table.addRow('Hooks skipped', this.numHooksSkipped ?
      'At least ' + this.numHooksSkipped : '-', '                                 -');

      table.addRow('Hooks stubbed', this.numHooksStubbed ?
      'At least ' + this.numHooksStubbed : '-', '                                 -');
      table.addRow('--------------------------', '         ---', '                                 -');
      table.addRow('Tests skipped', suitesSkipped ? 'At least ' + testsSkipped : (testsSkipped || '-'));
      table.addRow('Tests stubbed', testsStubbed || '-');
      table.addRow('Tests passed', testsPassed || '-');
      table.addRow('Tests failed', testsFailed || '-');
      table.addRow('Tests total', totalTests || '-');
      table.addRow('--------------------------', '          ---', '                                 -');
      table.addRow('Passing rate', passingRate);
      table.addRow('Total time millis (delta)', delta, '                                   -');
      table.addRow('Total time minutes (delta)', deltaMinutes, '                                   -');
    }

    //TODO: if root suite is skipped, it is noteworthy

    table.setAlign(0, AsciiTable.LEFT);
    table.setAlign(1, AsciiTable.RIGHT);
    table.setAlign(2, AsciiTable.RIGHT);

    process.nextTick(function () {
      cb(null, {
        exitCode: exitCode,
        tableData: table
      });
    });

  }

};

Suman.prototype.logData = function logData(test) {

  /// this should be used to store data in SQLite

  test.error = test.error || null;

  const result = {
    testId: test.testId,
    desc: test.desc,
    opts: test.opts,
    children: test.getChildren(),
    tests: _.flattenDeep([test.getTests(), test.getParallelTests()])
  };

  if (global.usingRunner) {

    var data = {
      test: result,
      type: 'LOG_DATA',
      outputPath: this.outputPath
    };

    //TODO: need to send log_data to runner so that writing to same file doesn't get corrupted?
    //TODO: or can we avoid this if only this process writes to the file?
    //TODO: note, only one process writes to this file since it is a 1:1 process per file
    // process.send(data);
    try {
      var json = JSON.stringify(data.test);
      fs.appendFileSync(this.outputPath, json += ',');
    }
    catch (e) {
      //TODO: this needs to log
      console.error(e.stack);
      // console.log('test data:', util.inspect(data.test));
    }

  }
  else {

    if (this.usingLiveSumanServer) {
      //TODO: we may want to log locally first just to make sure we have the data somewhere
      // this.networkLog.sendTestData(data);
      var json = JSON.stringify(result);
      fs.appendFileSync(this.outputPath, json += ',');
    }
    else if (this.outputPath && global.viaSuman === true) {

      var json = JSON.stringify(result);
      fs.appendFileSync(this.outputPath, json += ',');
    }

  }
};

Suman.prototype.logResult = function (test) {  //TODO: refactor to logTestResult

  //TODO: this function becomes just a way to log to command line, not to text DB

  const config = global.sumanConfig;

  if (global.usingRunner) {

    // only ignore if test has completed (no errors present)
    const ignore = global.sumanOpts.errors_only && test.dateComplete;

    if (!ignore) {
      const _test = {
        cb: test.cb,
        sumanModulePath: this._sumanModulePath,
        error: test.error ? (test.error._message || test.error.stack || test.error) : null,
        errorDisplay: test.errorDisplay,
        mode: test.mode,
        plan: test.planCountExpected,
        skip: test.skip,
        stubbed: test.stubbed,
        testId: test.testId,
        only: test.only,
        timedOut: test.timedOut,
        desc: test.desc,
        complete: test.complete,
        dateStarted: test.dateStarted,
        dateComplete: test.dateComplete
      };

      var data = {
        test: _test,
        type: 'LOG_RESULT',
        outputPath: this.outputPath
      };

      var str = JSON.stringify(data);
      str = str.replace(/(\r\n|\n|\r)/gm, ''); ///This javascript code removes all 3 types of line breaks
      process.send(JSON.parse(str));
    }

  }
  else {

    if (this.usingLiveSumanServer) {
      // this.networkLog.sendTestData(data);
    }
    else if (this.outputPath) {
      // var json = JSON.stringify(test);
      // fs.appendFileSync(this.outputPath, json += ',');
    }

    resultBroadcaster.emit('test-case-end', test.desc, test);

    const noColors = process.argv.indexOf('--no-color') > 0;

    if (process.env.SUMAN_DEBUG === 'yes') {
      console.log(' NO COLORS => ', noColors);
    }

    if (test.errorDisplay) {
      resultBroadcaster.emit(events.TEST_CASE_FAIL, '\n\n\t' +
        colors.bgWhite.black.bold(' ' + (noColors ? '(x)' : '\u2718') + '  => test fail ') + '  "' +
        test.desc + '"\n' + colors.yellow(test.errorDisplay) + '\n\n', test);
      // resultBroadcaster.emit(events.TEST_CASE_FAIL, '\n\n\t' +
      //   colors.bgWhite.black.bold(' \u2718  => test fail ') + '  "' +
      //   test.desc + '"\n' + colors.yellow(test.errorDisplay) + '\n\n', test);
    }
    else {

      if (test.skipped) {
        resultBroadcaster.emit(events.TEST_CASE_SKIPPED, '\t' +
          colors.yellow(' ' + (noColors ? '( - )' : '\u21AA ')) + ' (skipped) \'' + test.desc + '\'\n', test);
      }
      else if (test.stubbed) {
        resultBroadcaster.emit(events.TEST_CASE_STUBBED, '\t' +
          colors.yellow(' ' + (noColors ? '( --- )' : '\u2026 ')) + ' (stubbed) \'' + test.desc + '\'\n', test);
      }
      else {

        resultBroadcaster.emit(events.TEST_CASE_PASS, '\t' +
          colors.blue(' ' + (noColors ? '(check)' : '\u2714 ')) + ' \'' + test.desc + '\' ' +
          (test.dateComplete ? '(' + ((test.dateComplete - test.dateStarted) || '< 1') + 'ms)' : '') + '\n', test);

      }

    }
  }
};


function makeSuman($module, _interface, shouldCreateResultsDir, config, cb) {

  const cwd = process.cwd();
  var liveSumanServer = false;

  if (process.argv.indexOf('--live_suman_server') > -1) { //does our flag exist?
    liveSumanServer = true;
  }

  /*

   note: this was removed because when debugging with node-inspector process.send is defined

   */

  var timestamp;
  var outputPath = null;
  var networkLog = null;

  if (global.usingRunner) {  //using runner, obviously, so runner provides timestamp value
    timestamp = global.timestamp = process.env.SUMAN_RUNNER_TIMESTAMP;
    if (!timestamp) {
      console.error(new Error(' => Suman implementation error => no timestamp provided by Suman test runner').stack);
      process.exit(constants.EXIT_CODES.NO_TIMESTAMP_AVAILABLE_IN_TEST);
    }
  }
  else if (global.timestamp) {  //using suman executable, but not runner
    timestamp = global.timestamp;
  }
  else {  //test file executed with plain node executable
    timestamp = null;
  }

  //TODO: need to properly toggle the value for 'shouldCreateResultsDir'
  sumanUtils.makeResultsDir(shouldCreateResultsDir && !global.usingRunner, function (err) {

    if (err) {
      console.log(err.stack);
      process.exit(constants.EXIT_CODES.ERROR_CREATING_RESULTS_DIR);
    }
    else {

      const server = findSumanServer(null);

      //TODO: output path name needs to be incremented somehow by test per file, if there is more than 1 test per file
      if (timestamp) {
        outputPath = path.normalize(sumanUtils.getHomeDir() + '/suman/test_results/'
          + timestamp + '/' + path.basename($module.filename, '.js') + '.txt');
      }

      try {
        fs.unlinkSync(outputPath); //TODO can we remove this unlink call? I guess it's just in case the same timestamp exists..
      }
      catch (err) {
        //console.error(err.stack);
      }

      //TODO: if using runner, the runner should determine if the server is live

      cb(null, new Suman({
        fileName: path.resolve($module.filename),
        outputPath: outputPath,
        usingLiveSumanServer: liveSumanServer,
        networkLog: networkLog,
        server: server,
        interface: _interface
      }));

    }

  });
}

module.exports = makeSuman;
