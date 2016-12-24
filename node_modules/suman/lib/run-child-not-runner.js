'use striiiict';

//core
const path = require('path');
const util = require('util');

//npm
const colors = require('colors/safe');
const sumanUtils = require('suman-utils/utils');
const debug = require('suman-debug')('s');

//project
const constants = require('../config/suman-constants');

///////////////////////////////////////////////////////////////////////////////////////////

process.on('uncaughtException', function (err) {

  if (typeof err !== 'object') {
    const val = typeof err === 'string' ? err : util.inspect(err);
    console.error(' => Warning, value passed to uncaughtException handler was not typeof "object" => ', val);
    err = {stack: val}
  }

  process.nextTick(function () {
    // we attempt to let other uncaught-exception handlers do their thing by using nextTick,
    // but if they don't take care of business, then we step in here
    if (err && !err._alreadyHandledBySuman) {
      console.error('\n', ' => Suman uncaught exception =>', '\n', (err.stack || err), '\n\n');
    }

    process.exit(constants.EXIT_CODES.UNEXPECTED_FATAL_ERROR);
  });

});

const root = global.projectRoot || sumanUtils.findProjectRoot(process.cwd());
const sumanConfig = global.sumanConfig;


const sumanHelperDirRoot = global.sumanHelperDirRoot;
if (!sumanHelperDirRoot) {
  console.log(colors.red.bold(' => Suman helper root is falsy in run-child-not-runner.'));
}
else {
  debug(' => Suman helper root dir in run-child-not-runner =>', sumanHelperDirRoot);
}


try {
  require(path.resolve(sumanHelperDirRoot + '/suman.globals.js'));  //load globals
}
catch (err) {
  console.error('\n\n', colors.yellow.bold(' => Suman usage warning => Could not load your suman.globals.js file =>') +
    '\n' + (global.sumanOpts.verbose ? (err.stack || err) : '') + '\n');
}

function run(files) {

  if (process.env.USE_BABEL_REGISTER === 'yes') {

    console.log(colors.bgWhite.black.bold(' => Suman will use babel-register to transpile your sources on the fly, ' +
      'use the -v option for more info.'), '\n\n');

    require('babel-register')({
      ignore: /node_modules/
      // This will override `node_modules` ignoring - you can alternatively pass
      // an array of strings to be explicitly matched or a regex / glob
      // ignore: false
    });
  }

  if (process.env.SUMAN_SINGLE_PROCESS === 'yes') {
    console.log(' => Suman debug message => we are in SUMAN_SINGLE_PROCESS mode.');
    require('./helpers/log-stdio-of-child')('suman-single-process');
    require('./handle-single-proc')(files);
  }
  else {
    require('./helpers/log-stdio-of-child')(files[0]);
    require(files[0]);
  }

}

module.exports = run;

