'use striiiict';

//core
const assert = require('assert');

//npm
const colors = require('colors/safe');



//////////////////////////////////////////////////////////////////////////////////////

module.exports = function (sumanConfig, opts) {

  var err1,
    err2,
    sumanInstalledLocally = false,
    sumanInstalledAtAll = false,
    sumanServerInstalled = false;

  try {
    require.resolve(projectRoot + '/node_modules/suman');
    sumanInstalledLocally = true;
  } catch (e) {
    err1 = e;
  }
  finally {
    if (err1) {
      sumanInstalledLocally = false;
      if (!opts.sparse) {
        console.log(' ' + colors.yellow('=> Suman message => note that Suman is not installed locally, you may wish to run "$ suman --init"'));
      }
    }
    else {
      if (false) {  //only if user asks for verbose option
        console.log(' ' + colors.yellow('=> Suman message => Suman appears to be installed locally.'));
      }
    }
  }

  try {
    require.resolve('suman');
    sumanInstalledAtAll = true;
  } catch (e) {
    err1 = e;
  }
  finally {
    if (err1) {
      sumanInstalledAtAll = false;
      if (!opts.sparse || true) {
        console.log(' ' + colors.yellow('=> Suman message => note that Suman is not installed at all, you may wish to run "$ suman --init"'));
      }
    }
    else {
      if (opts.verbose) {  //only if user asks for verbose option
        console.log(' ' + colors.yellow('=> Suman message => Suman appears to be installed locally.'));
      }
    }
  }

  try {
    // require.resolve(projectRoot + '/node_modules/suman-server');
    // suman-server should be located in ~/.suman/node_modules
    require.resolve('suman-server');
    sumanServerInstalled = true;
  }
  catch (err) {
    sumanServerInstalled = false;
    if (opts.verbose) {
      console.log(' ' + colors.yellow('=> Suman verbose message => note that "suman-server" package is not yet installed.'));
    }
  }

  return {
    sumanServerInstalled: sumanServerInstalled,
    sumanInstalledLocally: sumanInstalledLocally,
    sumanInstalledAtAll: sumanInstalledAtAll
  }

};
