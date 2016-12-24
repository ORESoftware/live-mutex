//core
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

//npm
const async = require('async');
const colors = require('colors/safe');
const mkdirp = require('mkdirp');

/////////////////////////////////////////////////////////////

const installsGroupA = [
  'install',
  '--save-dev',
  'suman-server@latest',
  'frontail@latest'
];

module.exports = function useSumanServer(data, cb) {

  const root = global.projectRoot;

  console.log(' => Installing suman-server dependency in ~/.suman, preventing duplication of your dependencies on your machine.');

  //TODO: probably don't need this block anymore
  if (false && !global.sumanOpts.force && !process.env.SUDO_UID) {
    console.log('You may wish to run the the commmand with root permissions, since you are installing globally');
    console.log(' => if using "sudo" makes you unhappy, try "# chown -R $(whoami) $(npm root -g) $(npm root) ~/.npm"');
    console.log(' => To override this message, use --force\n');
    return;
  }

  const i = setInterval(function () {
    process.stdout.write('.');
  }, 500);

  const _cwd = path.resolve(process.env.HOME + '/.suman');

  async.series([
    function (cb) {
      mkdirp(_cwd, cb);
    },
    function (cb) {

      const n = cp.spawn('npm', installsGroupA, {
        cwd: _cwd
      });

      n.on('close', function (code) {
        clearInterval(i);
        cb.apply(null, arguments);
      });

      n.stderr.setEncoding('utf-8');

      var first = true;

      n.stderr.on('data', function (d) {
        if (first) {
          first = false;
          clearInterval(i);
          console.log('\n');
        }
        console.error(d);
      });
    }
  ], function (err) {
    if (err) {
      console.log('\n', colors.bgRed.white(' => Error => "suman-server" was *not* installed ' +
        'successfully =>'), '\n', (err.stack || err));
      process.exit(1);
    }
    else {
      console.log('\n\n', colors.bgBlue.white.bold(' => Suman message => "suman-server" was installed ' +
        'successfully into your local project.'));
      console.log('\n', colors.bgBlue.white.bold(' => To learn about how to use "suman-server" ' +
        'with Suman, visit ***.'), '\n');
      process.exit(0);
    }
  });

};
