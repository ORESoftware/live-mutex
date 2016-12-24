'use striiict';

//core
const cp = require('child_process');
const os = require('os');
const path = require('path');

//npm
const colors = require('colors/safe');

//project
const debug = require('suman-debug')('s:init');

/////////////////////////////////////////////////////////////////////////////

module.exports = function (data) {

  const pkgDotJSON = data.pkgDotJSON;
  const projectRoot = data.projectRoot;


  debug(' => Getting latest suman version with this data => ',data);

  return function getLatestSumanVersion (cb) {

    var first = true;

    function race () {
      if (first) {
        first = false;
        cb.apply(null, arguments);
      }
    }

    const to = setTimeout(race, 800);

    cp.exec('npm view suman version', function (err, stdout, stderr) {
      clearTimeout(to);

      if (err || String(stdout).match(/error/i) || String(stderr).match(/error/)) {
        race(err || stdout || stderr);
      }
      else {
        console.log('\n\n');
        console.log(colors.cyan(' => Newest Suman version in the NPM registry:'), String(stdout).replace('\n', ''));
        if (pkgDotJSON) {
          console.log(colors.cyan(' => Locally installed Suman version:'), pkgDotJSON.version);
        }

        race(null);
      }
    });

  }

};


