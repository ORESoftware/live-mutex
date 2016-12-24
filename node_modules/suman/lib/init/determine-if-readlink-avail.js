'use striiict';

//core
const cp = require('child_process');
const os = require('os');
const path = require('path');

//npm
const colors = require('colors/safe');

//project
const constants = require('../../config/suman-constants');
const sumanUtils = require('suman-utils/utils');

/////////////////////////////////////////////////////////////////////////////

module.exports = function (data) {

  const pkgDotJSON = data.pkgDotJSON;
  const projectRoot = data.projectRoot;

  return function whichReadlink(cb) {

    cp.exec('which readlink', function (err, stdout, stderr) {
      if (err || stderr) {
        cb(String((err.stack || err) + '\n' + stderr));
      }
      else if (String(stdout).indexOf(path.sep) > -1) {
        console.log(' => readlink utility is located here => ', colors.green.bold(stdout));
        cb(null);
      }
      else {
        console.log('\n', colors.red.bold(' => You will need to install a "readlink" utility on your machine. ' +
          'See: http://oresoftware.github.io/suman/readlink.html'), '\n');
        cb(null);
      }
    });

  }

};






