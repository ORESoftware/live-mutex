'use strict';

//core
const util = require('util');
const fs = require('fs');
const assert = require('assert');

//npm
const colors = require('colors/safe');

//project
const constants = require('../config/suman-constants');

const testErrors = global.testErrors = global.testErrors || [];
const errors = global.sumanRuntimeErrors = global.sumanRuntimeErrors || [];

////////////////////////////////////////////////////////////////////

process.on('exit', function (code, signal) {

  if (errors.length > 0) {
    code = code || constants.EXIT_CODES.UNEXPECTED_NON_FATAL_ERROR;
    errors.forEach(function (e) {
      if (global.usingRunner) {
        process.stderr.write(typeof e === 'string' ? e : util.inspect(e.stack || e));
      }
      if (global._writeTestError) {
        global._writeTestError(typeof e === 'string' ? e : util.inspect(e.stack || e));
      }

    });
  }
  else if (testErrors.length > 0) {
    code = code || constants.EXIT_CODES.TEST_CASE_FAIL;
  }

  if (global._writeTestError) {
    global._writeTestError('\n\n ### Suman end run ### \n\n\n\n', true);
  }

  if (global._writeLog) {
    if (process.env.SUMAN_SINGLE_PROCESS === 'yes') {
      global._writeLog('\n\n\ [ end of Suman individual test run for file => "' + global._currentModule + '" ]');
    }
    else {
      global._writeLog('\n\n\ [ end of Suman run in SUMAN_SINGLE_PROCESS mode ]');
    }

  }

  if (code > 0 && testErrors.length < 1) {   //TODO: fix this with logic saying if code > 0 and code < 60 or something
    if (!global.usingRunner) { //TODO: need to fix this
      process.stdout.write('\n' + colors.bgWhite.yellow.bold(' => Suman test process experienced a fatal error during the run, ' +
          'most likely the majority of tests, if not all tests, were not run.') + '\n');
    }
  }

  if (global.checkTestErrorLog) {
    process.stdout.write('\n' + colors.bgWhite.yellow.bold(' => You have some additional errors/warnings - check the test debug log ' +
        '(<sumanHelpersDir>/logs/test-debug.log) for more information.') + '\n');
  }

  if (Number.isInteger(global.expectedExitCode)) {
    if (code !== global.expectedExitCode) {
      global._writeTestError(' => Expected exit code not met. Expected => '
        + global.expectedExitCode + ', actual => ' + code);
      code = constants.EXIT_CODES.EXPECTED_EXIT_CODE_NOT_MET;
    }
    else {
      code = 0;
    }
  }

  if (!global.usingRunner) {

    var extra = '';
    if (code > 0) {
      extra = ' => see http://oresoftware.github.io/suman/exit-codes.html';
    }

    console.log('\n\n => Suman test is exiting with code ' + code + ' ', extra, '\n');
  }

  process.exit(code);

});

