'use striiiict';

//core
const path = require('path');
const util = require('util');
const os = require('os');
const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const EE = require('events');

//npm
const colors = require('colors/safe');
const sumanUtils = require('suman-utils/utils');

//project
const cwd = process.cwd();
const projectRoot = global.projectRoot || sumanUtils.findProjectRoot(cwd);

////////////////////////////////////////////////////////////////////////////

module.exports = function Runner(obj) {

  const $NODE_ENV = obj.$node_env;
  const runObj = obj.runObj;

  const ee = new EE();
  global.sumanOpts.__maxParallelProcesses = global.sumanOpts.processes || global.sumanConfig.maxParallelProcesses;
  const strmPath = global.sumanRunnerStderrStreamPath = path.resolve(global.sumanHelperDirRoot + '/logs/runner-debug.log');
  const strm = global.sumanStderrStream = fs.createWriteStream(strmPath);
  // const strmStdoutPath = path.resolve(global.sumanHelperDirRoot + '/logs/runner-stdout.log');
  // const strmStdout = global.sumanStdoutStream = fs.createWriteStream(strmStdoutPath);

  strm.write('\n\n### Suman runner start ###\n\n');
  strm.write('Beginning of run at ' + Date.now() + ' = [' + new Date() + ']' + '\n');
  strm.write('Command issued from the following directory "' + cwd + '"\n');
  strm.write('Command = ' + JSON.stringify(process.argv) + '\n');

  /////////////// validate suman.once.js //////////////////////////////////////////////////////////

  const oncePath = path.resolve(global.sumanHelperDirRoot + '/suman.once.pre.js');

  var runOnce = null;

  try {
    runOnce = require(oncePath);
    assert(typeof runOnce === 'function', 'runOnce is not a function.');
  }
  catch (err) {
    if (err instanceof assert.AssertionError) {
      console.error('Your suman.once.js module is defined at the root of your project,\n' +
        'but it does not export a function and/or return an object from that function.');
      throw err;
    }
  }

  runOnce = runOnce || function () {
      return {};
    };

  ////////////// validate suman.order.js ///////////////////////////////////////////////////////////
  const orderPath = path.resolve(global.sumanHelperDirRoot + '/suman.order.js');

  var fn, order = null;

  try {
    fn = require(orderPath);
    if (fn) {
      order = fn();
    }
  }
  catch (err) {
    if (fn) {
      throw new Error(' => Your suman.order.js file needs to export a function.');
    }
    else if (!global.usingDefaultConfig || process.env.SUMAN_DEBUG === 'yes') {
      console.log(colors.magenta(' => Suman warning => Your suman.order.js file could not be located,' +
          ' given the following path to your "<sumanHelpersDir>" => ') +
        '\n' + colors.bgBlack.cyan(global.sumanHelperDirRoot));
    }
  }

  if (order) {
    //will throw error if invalid, halting the program
    require('./input-validation/validate-suman.order.js')(order);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////

  sumanUtils.makeResultsDir(true, function (err) {

    if (err) {
      console.log(err.stack);
    }
    else {
      require('./runner')(runObj, runOnce, order);
      setImmediate(function () {
        ee.emit('exit');
      });
    }

  });

  return ee;

};
