debugger;

if (process.env.NPM_COLORS === 'no') {
  //note that we set this here in case NPM "colors" package needs to this set before hand...
  process.argv.push('--no-color');
  console.error(' => Suman child process setting itself to be color-free (--no-colors)');
}

//core
const path = require('path');
const util = require('util');
const assert = require('assert');

//npm
const colors = require('colors/safe');

//project
const constants = require('../config/suman-constants');
const sumanUtils = require('suman-utils/utils');
const fatalRequestReply = require('./helpers/fatal-request-reply');

//////////////////////////////////////////////////////////////////////////////

//TODO: should pass sumanOpts from runner to child processes
const sumanOptsFromRunner = process.env.SUMAN_OPTS ? JSON.parse(process.env.SUMAN_OPTS) : {};
const sumanOpts = global.sumanOpts = (global.sumanOpts || sumanOptsFromRunner);

const usingRunner = global.usingRunner = true;
const projectRoot = global.projectRoot = process.env.SUMAN_PROJECT_ROOT;

if (process.env.SUMAN_DEBUG === 'yes') {
  console.error(' => child args => ', util.inspect(process.argv));
  console.error(' => child env => ', util.inspect(process.env));
}

process.send = process.send || function (data) {
    console.error(colors.magenta('=> Suman implementation warning => Runner cannot receive data because process.send was not defined ' +
        '(Perhaps we are using Istanbul?), so logging it here => '),
      '\n', colors.yellow(util.inspect(data)));
  };

process.on('uncaughtException', function (err) {

  if (typeof err !== 'object') {
    err = {
      message: typeof err === 'string' ? err : util.inspect(err),
      stack: typeof err === 'string' ? err : util.inspect(err)
    }
  }

  process.nextTick(function () {

    // we let more recently registered uncaughtException handlers take care of this

    if (!err._alreadyHandledBySuman) {
      err._alreadyHandledBySuman = true;

      console.error(' => Suman => Uncaught exception in your test =>', '\n', (err.stack || err) + '\n\n');

      fatalRequestReply({
        type: constants.runner_message_type.FATAL,
        data: {
          msg: ' => Suman => fatal error in suite with path="' + filePath + '"' +
          '\n (note: You will need to transpile your test files if you wish to use ES7 features)',
          error: err.stack || err
        }
      }, function(){

        if (String(err.stack || err).match(/Cannot find module/i) && global.sumanOpts && global.sumanOpts.transpile) {
          console.error(' => If transpiling, you may need to transpile your entire test directory to the target directory using the ' +
            '--transpile options together.')
        }

        process.exit(constants.EXIT_CODES.UNEXPECTED_FATAL_ERROR);
      });

    }
  });


});


///////////////////////////////////////
debugger;


//////// delete env vars that should not get passed to any cp's forked from this process //////////

delete process.env.SUMAN_SINGLE_PROCESS;


///////////////////////////////////////////////////////////////////////////////////////////////////

const filePath = process.env.SUMAN_CHILD_TEST_PATH;

var sumanConfig;
if (process.env.SUMAN_CONFIG) {
  assert(typeof process.env.SUMAN_CONFIG === 'string', 'process.env.SUMAN_CONFIG is not a string.');
  sumanConfig = global.sumanConfig = JSON.parse(process.env.SUMAN_CONFIG);
}
else {
  sumanConfig = global.sumanConfig = require(path.resolve(projectRoot + '/suman.conf.js'));
}

const sumanHelperDirRoot = global.sumanHelperDirRoot = process.env.SUMAN_HELPERS_DIR_ROOT;

assert(sumanHelperDirRoot,
  ' => sumanHelperDirRoot should be defined by process.env.SUMAN_HELPERS_DIR_ROOT, but is null/undefined');

//////////////////////////////////////////////////

require('./helpers/log-stdio-of-child')(filePath);

//////////////////////////////////////////////////////////

const useBabelRegister = global.useBabelRegister = (process.env.USE_BABEL_REGISTER === 'yes');

if (useBabelRegister) {

  console.error(colors.bgRed.white(' => We are using babel-register.'));

  require('babel-register')({
    // This will override `node_modules` ignoring - you can alternatively pass
    // an array of strings to be explicitly matched or a regex / glob
    ignore: /node_modules/
    // ignore: false
  });
}

////////////////////////////////////////////////////////

const singleProc = process.env.SUMAN_SINGLE_PROCESS === 'yes';

////////////////////////////////////////////////////////

const domain = require('domain');
const d = domain.create();

d.once('error', function (err) {

  err = err.stack || err;

  fatalRequestReply({
    type: constants.runner_message_type.FATAL,
    data: {
      msg: ' => Suman => fatal error in suite with path="' + filePath + '"',
      error: err
    }
  }, function(){
    console.error(err);
    process.exit(constants.EXIT_CODES.UNEXPECTED_FATAL_ERROR_DOMAIN_CAUGHT);
  });

});

//load globals
try {
  require(path.resolve(sumanHelperDirRoot + '/suman.globals.js'));
}
catch (err) {
  console.error(colors.yellow.bold(' => Suman usage warning => Could not load your suman.globals.js file.')
    + '\n' + (global.sumanOpts.verbose ? (err.stack || err) : ''), '\n');
}

if (singleProc) {
  d.run(function () {
    require('./handle-single-proc')(JSON.parse(process.env.SUMAN_SINGLE_PROCESS_FILES));
  });
}
else {

  console.log('About to run domain...');

  d.run(function () {
    process.nextTick(function () {
      console.log('Requring filepath => ' + filePath);
      require(filePath);
    });
  });
}

