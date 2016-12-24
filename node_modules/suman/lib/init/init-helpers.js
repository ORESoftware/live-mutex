'use striiict';


//core
const cp = require('child_process');
const os = require('os');

//npm
const colors = require('colors/safe');

//project
const constants = require('../../config/suman-constants');
const sumanUtils = require('suman-utils/utils');

/////////////////////////////////////////////////////////////////////////////////////////////

var logged = true;

module.exports = {

  logPermissonsAdvice: function logPermissonsAdvice () {
    if (logged) {
      logged = false;
      console.log('\n\n' + colors.magenta(' => You may wish to run the "$ suman --init" commmand with root permissions.'));
      console.log(colors.magenta(' => If using sudo to run arbitrary/unknown commands makes you unhappy, then please use chown as following:'));
      console.log(colors.bgBlack.cyan('  # chown -R $(whoami) $(npm root -g) $(npm root) ~/.npm  ') + '\n\n');
    }
  }

};