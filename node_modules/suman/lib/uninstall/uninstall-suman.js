/**
 * Created by denmanm1 on 3/20/16.
 */


//#core
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const os = require('os');

//#npm
const async = require('async');
const colors = require('colors');

//#project
const sumanUtils = require('suman-utils/utils');

module.exports = opts => {

  const force = opts.force;
  const fforce = opts.fforce;
  const removeBabel = opts.removeBabel;

  const cwd = process.cwd();
  const root = sumanUtils.findProjectRoot(cwd);

  //TODO: we need to install babel globally
  //TODO: we need to make sure that root contains package.json file, otherwise tell them they should run npm init first

  try {
    require(path.resolve(cwd + '/package.json'));
  }
  catch (err) {
    console.log(' => Suman message => there is no package.json file in your working directory.');
    console.log(' => Perhaps you are in the wrong directory?');
    console.log(' => At the moment, it looks like the root of your project is here: ' + root);
    console.log(' => To use this value as project root use the --force option, otherwise cd into the correct directory and reissue the ' +
      '"$ suman --uninstall" command.');
    return;
  }

  if (!force) {
    console.log(colors.red(' => Suman warning => you are about to uninstall suman from your local project.'));
    if(removeBabel){
      console.log(' => Note that you will also be removing all Babel deps used by Suman, because you used the --remove-babel options.');
    }
    console.log('\n','=> Suman warning => This routine will delete the following items:');
    console.log(' => suman/ and all its contents');
    console.log(' => test-target/ and all its contents');
    console.log(' => suman.conf.js');
    console.log('\n', colors.bgRed('To proceed please use the --force option.'));
    return;
  }

  console.log(' => Suman message => Uninstalling suman locally...using "npm uninstall --save-dev --save suman"...');

  async.series([
    function (cb) {
      if (opts.removeBabel) {
        const items =
          [ 'uninstall',
            'babel-cli',
            'babel-core',
            'babel-loader',
            'babel-polyfill',
            'babel-runtime',
            'babel-register',
            'babel-plugin-transform-runtime',
            'babel-preset-es2015',
            'babel-preset-es2016',
            'babel-preset-react',
            'babel-preset-stage-0',
            'babel-preset-stage-1',
            'babel-preset-stage-2',
            'babel-preset-stage-3' ];

        const s = cp.spawn('npm', items, {
          cwd: cwd
        });

        s.stdout.on('data', (data) => {
          console.log(String(data));
        });

        s.stderr.on('data', (data) => {
          console.error(String(data));
        });

        s.on('close', (code) => {
          if (code > 0) {  //explicit for your pleasure
            console.error(' => Suman installation error => NPM install script exited with non-zero code: ' + code);
          }
          cb(null);
        });
      }
      else {
        process.nextTick(cb);
      }

    },
    function (cb) {
      async.parallel([
        function (cb) {
          if (os.platform() === 'win32') {

            console.log(' => Suman message => This may take a while if you are on Windows, be patient.');
            cp.exec('cd ' + cwd + ' && npm uninstall --save-dev --save suman', function (err, stdout, stderr) {

              if (err) {
                console.error(' => Suman installation error => ' + err.stack);
              }
              if (String(stderr).match(/error/i)) {
                console.error(' => Suman installation error => ' + stderr);
              }
              if (String(stdout).match(/error/i)) {
                console.error(' => Suman installation error => ' + stdout);
              }

              console.log(stdout);
              cb(null);
            });

          }
          else {

            const s = cp.spawn('npm', [ 'uninstall', '--save-dev', '--save', 'suman' ], {
              cwd: cwd
            });

            s.stdout.on('data', (data) => {
              console.log(String(data));
            });

            s.stderr.on('data', (data) => {
              console.error(String(data));
            });

            s.on('close', (code) => {
              if (code > 0) {  //explicit for your pleasure
                console.error(' => Suman installation error => NPM install script exited with non-zero code: ' + code);
              }
              cb(null);
            });
          }
        },
        function (cb) {
          cp.exec('rm -rf suman', function (err, stdout, stderr) {
            if (err) {
              console.error(err.stack);
            }
            if (String(stdout).match(/error/i)) {
              console.error(stdout);
            }
            if (String(stderr).match(/error/i)) {
              console.error(stderr);
            }

            cb(null);

          });
        },
        function (cb) {
          cp.exec('rm -rf test-target', function (err, stdout, stderr) {
            if (err) {
              console.error(err.stack);
            }
            if (String(stdout).match(/error/i)) {
              console.error(stdout);
            }
            if (String(stderr).match(/error/i)) {
              console.error(stderr);
            }

            cb(null);
          });
        },
        function (cb) {
          fs.unlink(cwd + '/suman.conf.js', function (err) {
            if (err) {
              console.error(err.stack);
            }
            cb(null);
          });
        }
      ], cb);
    }
  ], function (err) {

    if (err) {
      console.error('=> Suman uninstall error => ' + err.stack);
      process.exit(1);
    }
    else {
      console.log('\n' + colors.bgGreen.black(' => Suman has been successfully uninstalled.') + '\n');
      process.exit(0);
    }

  });

};