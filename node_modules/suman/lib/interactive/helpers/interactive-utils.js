'use striiiict';

//core
const util = require('util');
const path = require('path');
const readline = require('readline');

//npm
const colors = require('colors/safe');

//project
const sumanUtils = require('suman-utils/utils');

/////////////////////////////////////////////////////

module.exports = Object.freeze({

  createCallback: function (run, opts, cb) {

    const _cb = run.bind(null, opts, cb);

    return function () {
      global.backspacing = true;
      _cb();
    }

  },

  allDoneHere: function (cmdArray, exit, cb) {
    console.log('\n\n', ' => All done here! The valid Suman command to run is =>');
    console.log('  => ', colors.bgBlue.yellow.bold(' ' + cmdArray.join(' ')));
    console.log('\n');
    if (exit) {
      process.exit(0);
    }
    else {
      console.log(colors.green('  => Use the backspace key if you wish to go back and form a different command.\n'));
      var index = 11;
      const i = setInterval(function () {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        index--;
        if (index === 0) {
          process.stdout.write('\n\n');
          process.stdout.write(colors.blue('  ...And we are done here. :)'));
          process.stdout.write('\n\n');
          process.exit(0);
        }
        else {
          process.stdout.write(' The countdown has begun => ' + String(index));
        }

      }, 1000);

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('keypress', function a () {
        process.stdin.removeListener('keypress', a);
        clearInterval(i);
        process.nextTick(cb);
      });

    }

  },

  mapSumanExec: function (exec, localOrGlobal) {

    _interactiveDebug(' => exec => ', exec, 'localOrGlobal =>', localOrGlobal);

    if (String(exec).startsWith('suman')) {
      if (localOrGlobal === 'local') {
        exec = './node_modules/.bin/' + exec;
      }
    }
    return exec;
  },

  mapDirs: function (pathsToRun) {
    return pathsToRun.map(function (p) {
      if (!path.isAbsolute(p)) {
        return p;
      }
      return sumanUtils.removePath(p, global.projectRoot);
    }).join(' ');
  }

});
