'use striiiict';

//core
const http = require('http');
const path = require('path');
const cp = require('child_process');
const util = require('util');
const assert = require('assert');
const fs = require('fs');

//npm
const colors = require('colors/safe');
const socketio = require('socket.io-client');
const _ = require('lodash');

//project
const sumanServer = require('../create-suman-server');

function watch (data, pathsToWatch, cb) {

  //NOTE: pathToWatch is a single path for now, later we will implement multiple paths

  var watchObjectFromConfig = true, paths = null;

  if (!data) {
    watchObjectFromConfig = false;

    paths = _.flattenDeep([ pathsToWatch ]);

    paths.forEach(function (p) {
      assert(path.isAbsolute(p), ' => Suman implementation error => path should be absolute here => ' + util.inspect(p));
    });

    data = {};
  }

  var finished = false;

  function finish (err) {
    if (!finished) {
      finished = true;
      process.nextTick(function () {
        cb(err);
      });
    }
    else if (err) {
      console.log('Error after the fact =>', err.stack || err);
    }
  }

  const debugStrm = fs.createWriteStream(path.resolve(global.sumanHelperDirRoot + '/logs/suman-debug.log'));

  debugStrm.write('\n\nbeginning.\n\n');

  const optz = global.sumanOpts;
  const testDir = process.env.TEST_DIR;
  const testSrcDir = process.env.TEST_SRC_DIR;
  const testTargetDir = process.env.TEST_TARGET_DIR;
  const targetDir = path.resolve(testTargetDir ? testTargetDir : (testSrcDir + '-target'));

  if (optz.verbose) {
    console.log('\n\t' + colors.magenta('--watch option set to true'));
  }

  if (!optz.vsparse && optz.all) {
    console.log('\n\t' + ' => ' + colors.magenta('--watch') + ' option set to true => background watcher will be started that will');
    console.log('\t' + '    listen for changes to any file in your ' + colors.blue(' "' + testSrcDir + '" ') + ' directory');

    if (!optz.sparse) {
      console.log('\t => ' + colors.magenta(' --all') + ' option used which always tells Suman to work with ' +
        'the directory specified by the "testDir" property in your config.');
    }

    if (optz.transpile) {
      console.log('\t' + ' => Files will be transpiled to  ' + colors.blue(' "' + targetDir + '" '));
    }
    if (optz.transpile && optz.no_run) {
      console.log('\t => However, since the --no-run option was used, the watcher will only transpile files but not run them.');
    }
    else {
      console.log('\t => Suman will execute any test file that experiences changes observed by the watch process.');
    }
  }

  if (optz.verbose) {
    console.log('Suman will send the following paths to Suman server watch process:', paths);
  }

  const projectOutputLog = path.resolve(global.sumanHelperDirRoot + '/logs/project-watcher-output.log');

  sumanServer({

    root: global.projectRoot,
    config: global.sumanConfig
    //TODO: force localhost here!

  }, function (err, val) {

    if (err) {
      console.error('Suman server init error =>', err.stack || err || '');
      finish(err);
    }
    else {

      var runErrors = false;

      setTimeout(function () {
        runErrors = true;
      }, 4000);

      setTimeout(function () {

        const s = socketio('http://' + val.host + ':' + val.port);

        s.once('connect', function () {

          if (optz.verbose) {
            console.log('\n', 'Web-socket connection to Suman server successful.', '\n');
          }

          if (process.env.SUMAN_DEBUG === 'yes') {
            console.log(' => Suman about to send watch message to Suman server =>', '\n', util.inspect(optz));
          }

          if (watchObjectFromConfig) {

            this.once('watch-project-request-received', function (msg) {
              this.removeAllListeners();
              console.log('\n\n\t' + colors.green.underline.bold(' => Run the following command in a new terminal to view watch results =>') + '' +
                '\n\t' + colors.blue('tail -f ' + path.resolve(global.sumanHelperDirRoot + '/logs/project-watcher-output.log')));
              finish(null, msg);
            });

            var SIG_EVENT_CAPTURED = false;

            process.on('exit', code => {
              if (!SIG_EVENT_CAPTURED) {
                this.emit('stop-tty', 'terminal window was likely closed');
              }
            });

            function onSIGEvent () {

              debugStrm.write('SIGEVENT captured');

              SIG_EVENT_CAPTURED = true;
              console.log('\n\n', colors.cyan(' => SIGINT received, taking action...'),'\n\n');

              setTimeout(function () {
                process.exit(1);
              }, 2000);

              this.on('stop-tty-received', function () {
                console.log('\n => SIGINT received =>  we will stop streaming watch results to the terminal,\n' +
                  'but they will continue to be streamed to the project-watch log file, here => \n ' +
                  colors.magenta(projectOutputLog), '\n\n');
                process.nextTick(function () {
                  process.exit(0);
                });
              });

              this.emit('stop-tty', 'SIGINT captured');
            }

            process.on('SIGTERM', onSIGEvent.bind(this));
            process.on('SIGINT', onSIGEvent.bind(this));

            const script = data.script;
            const include = data.include;
            const exclude = data.exclude;

            this.emit('watch-project', JSON.stringify({
              fd_stdout: val.fd_stdout,
              fd_stderr: val.fd_stderr,
              script: script,
              transpile: optz.transpile,
              include: include || null,
              exclude: exclude || null,

            }));
          }
          else {

            this.once('watch-request-received', function (msg) {
              this.removeAllListeners();
              console.log('\n\n\t' + colors.green.underline.bold(' => Run the following command in a new terminal to view watch results =>')
                + '\n\t' + colors.blue('tail -f ' + path.resolve(global.sumanHelperDirRoot + '/logs/watcher-output.log')));
              finish(null, msg);
            });

            this.emit('watch', JSON.stringify({
              paths: paths,
              transpile: optz.transpile,
              executeTests: !!optz.no_run
            }));

          }

        });

        s.once('connect_timeout', function (err) {

          console.log(' => Suman server connection timeout :(');
          setTimeout(function () {
            finish(new Error('connect_timeout' + (err.stack || err || '')));
          }, 500);

        });

        s.once('connect_error', function (err) {

          if (runErrors) {
            console.log(' => Suman server "connect_error":', err.stack);
            setTimeout(function () {
              finish(err);
            }, 5000);
          }

        });

        s.once('error', function (err) {

          console.log('\n => Suman server connection "error":', err.stack);
          console.log('\n\n => Please check your logs/server.log file for more info.');

          setTimeout(function () {
            finish(err);
          }, 500);

        });
      }, 700);
    }

  });

}

module.exports = watch;