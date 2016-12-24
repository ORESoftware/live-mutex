'use striiict';

//core
const path = require('path');
const assert = require('assert');
const fs = require('fs');
const util = require('util');

//npm
const colors = require('colors/safe');

//project
const sumanUtils = require('suman-utils/utils');
const constants = require('../../config/suman-constants');

////////////////////////////////////////////////////////////////////////////////////

var loaded;

module.exports = function loadSharedObjects (pathObj, projectRoot) {

  if (loaded) {
    return loaded;
  }

  if (global.sumanOpts.init) {
    return loaded = {};
  }

  //TODO: use this value instead of global value
  const sumanHelpersDir = global.sumanHelperDirRoot;
  const logDir = pathObj.sumanLogDir;
  const sumanHelpersDirLocated = pathObj.sumanHelpersDirLocated;

  try {
    fs.statSync(logDir);
  }
  catch (err) {
    if (sumanHelpersDirLocated) {
      console.error('\n', colors.blue(' => Suman could successfully locate your "<sumanHelpersDir>", but...\n')
        + colors.yellow.bold(' ...Suman could not find the <sumanHelpersDir>/logs directory...you may have accidentally deleted it, ' +
          'Suman will re-create one for you.'));
    }

    try {
      fs.mkdirSync(logDir);
    }
    catch (err) {
      console.error('\n\n', colors.red(' => Suman fatal problem => ' +
        'Could not create logs directory in your sumanHelpersDir,\n' +
        'please report this issue. Original error => \n' + (err.stack || err), '\n\n'));
      process.exit(constants.EXIT_CODES.COULD_NOT_CREATE_LOG_DIR);
    }

  }

  var integrantPreFn;

  try {
    integrantPreFn = require(path.resolve(global.sumanHelperDirRoot + '/suman.once.pre.js'));
  }
  catch (err) {

    if (!global.sumanOpts.sparse) {
      console.error('\n', colors.magenta('=> Suman usage warning: no suman.once.pre.js file found.'), '\n');
    }

    if (global.sumanOpts.vverbose) {
      console.error('\n', colors.magenta(err.stack || err), '\n');
    }

    if (global.sumanOpts.strict) {
      process.exit(constants.EXIT_CODES.SUMAN_PRE_NOT_FOUND_IN_YOUR_PROJECT);
    }

  }

  var iocFn;

  try {
    iocFn = require(path.resolve(global.sumanHelperDirRoot + '/suman.ioc.js'));
  }
  catch (err) {
    try {
      iocFn = require(path.resolve(projectRoot + '/suman/suman.ioc.js'));
    } catch (err) {
      if (sumanHelpersDirLocated) {
        console.log('\n\n', colors.bgBlack.cyan('=> Suman tip => Create your own suman.ioc.js file ' +
          'instead of using the default file.'), '\n');
      }
      iocFn = require('../default-conf-files/suman.default.ioc.js');
    }
  }

  try {
    assert(((integrantPreFn === undefined) || (typeof integrantPreFn === 'function')),
      'Your suman.once.pre.js file needs to export a function.');
    assert((iocFn === undefined) || typeof iocFn === 'function',
      ' => Your suman.ioc.js file does not export a function. Please fix this situation.');
  }
  catch (err) {
    console.error('\n\n', colors.magenta(err.stack || err), '\n\n');
    process.exit(constants.EXIT_CODES.SUMAN_HELPER_FILE_DOES_NOT_EXPORT_EXPECTED_FUNCTION);
  }

  return loaded = {
    iocFn: global.sumanIoc = iocFn,
    integrantPreFn: global.integrantPreFn = integrantPreFn
  }

};

