'use striiict';

//core
const path = require('path');
const fs = require('fs');
const assert = require('assert');

//npm
const colors = require('colors/safe');

//project
const sumanUtils = require('suman-utils/utils');
const constants = require('../../config/suman-constants');

///////////////////////////////////////////////////////////////////

var loaded;

///////////////////////////////////////////////////////////////////

module.exports = function (sumanConfig, projectRoot) {

  if (loaded) {
    return loaded;
  }

  if (global.sumanOpts.init) {
    return loaded = {};
  }

  var sumanHelpersDir, shd;
  if (shd = global.sumanOpts.suman_helpers_dir) {
    sumanHelpersDir = (path.isAbsolute(shd) ? shd : path.resolve(projectRoot + '/' + shd));
  }
  else {
    sumanHelpersDir = path.resolve(projectRoot + '/' + (sumanConfig.sumanHelpersDir || 'suman'));
  }

  var sumanHelpersDirLocated = false;

  try {
    fs.statSync(sumanHelpersDir);
    sumanHelpersDirLocated = true;
  }
  catch (err) {
    shd = path.resolve('./' + sumanUtils.removePath(sumanHelpersDir, projectRoot));
    console.error('\n\n', colors.magenta('=> Suman could not locate your <sumanHelpersDir>; ' +
        'perhaps you need to update your suman.conf.js file, please see: '), '\n',
      colors.cyan('oresoftware.github.io/suman/conf.html'), '\n',
      ' => We expected to find your <sumanHelpersDir> here =>', '\n',
      colors.bgBlack.cyan(shd), '\n',
      '...We will create a temporary suman helpers directory to keep things moving.');

    if (global.sumanOpts.verbose || process.env.SUMAN_DEBUG === 'yes') {
      console.log(colors.red(err.stack || err));
    }

    if (global.sumanOpts.strict) {
      console.log(' => Exiting because you have used the --strict option and we could not locate the <sumanHelpersDir>\n' +
        'given your configuration and command line options.');
      process.exit(constants.EXIT_CODES.COULD_NOT_LOCATE_SUMAN_HELPERS_DIR);
    }
    else {
      sumanHelpersDir = path.resolve(projectRoot + '/suman-' + Date.now());
      fs.mkdirSync(sumanHelpersDir);
      console.log(' ...Temporary <sumanHelpersDir> directory written here =>');
      console.log(colors.magenta(sumanHelpersDir));
      fs.writeFileSync(sumanHelpersDir + '/.readme-immediately', 'This (temporary) directory was created because you have yet to ' +
        'create a suman helpers directory,\nor it was deleted. When running "suman --init", a directory called "suman" is created at the ' +
        'root of your project.\nYou can move this directory as desired, as long as you update suman.conf.js accordingly.\nPlease see these instructions on how to remedy the situation:\n' +
        '=> http://oresoftware.github.io/suman/init.html');
    }
  }

  // const logDir = path.resolve(global.sumanHelperDirRoot + '/logs');
  const logDir = path.resolve(sumanHelpersDir + '/logs');
  const integPrePath = path.resolve(sumanHelpersDir + '/suman.once.pre.js');
  const integPostPath = path.resolve(sumanHelpersDir + '/suman.once.post.js');

  //TODO possibly reconcile these with cmd line options
  const testSrcDirDefined = !!sumanConfig.testSrcDir; //TODO: check for valid string
  const testTargetDirDefined = !!sumanConfig.testTargetDir;

  const testDir = process.env.TEST_DIR = path.resolve(projectRoot + '/' + (sumanConfig.testDir || 'test'));
  const testSrcDir = process.env.TEST_SRC_DIR = path.resolve(projectRoot + '/' + (sumanConfig.testSrcDir || 'test'));
  const testTargetDir = process.env.TEST_TARGET_DIR =
    testTargetDirDefined ? path.resolve(projectRoot + '/' + (sumanConfig.testTargetDir)) :
      path.resolve(testSrcDir + '/../' + 'test-target');

  const errStrmPath = path.resolve(sumanHelpersDir + '/logs/test-debug.log');
  const strmStdoutPath = path.resolve(sumanHelpersDir + '/logs/test-output.log');

  return loaded = Object.freeze({
    sumanHelpersDir: global.sumanHelperDirRoot = process.env.SUMAN_HELPERS_DIR_ROOT = sumanHelpersDir,
    sumanLogDir: global.sumanLogDir = logDir,
    integPrePath: global.integPrePath = integPrePath,
    integPostPath: global.integPostPath = integPostPath,
    sumanHelpersDirLocated: sumanHelpersDirLocated,
    testDebugLogPath: errStrmPath,
    testLogPath: strmStdoutPath
  });

};
