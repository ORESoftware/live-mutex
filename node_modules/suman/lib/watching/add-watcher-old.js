'use striiiict';

//core
const http = require('http');
const path = require('path');
const cp = require('child_process');
const util = require('util');

//npm
const colors = require('colors/safe');
const socketio = require('socket.io-client');

//project
const sumanServer = require('../create-suman-server');

function watch (paths, cb) {

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

  const opts = global.sumanOpts;
  const testDir = process.env.TEST_DIR;
  const testSrcDir = process.env.TEST_SRC_DIR;
  const testTargetDir = process.env.TEST_TARGET_DIR;
  const projectRoot = global.projectRoot;

  const targetDir = path.resolve(testTargetDir ? testTargetDir : (testDir + '-target'));

  if (global.sumanOpts.verbose) {
    console.log('\n\t' + colors.magenta('--watch option set to true'));
  }

  if (!global.sumanOpts.vsparse && global.sumanOpts.all) {
    console.log('\n\t' + ' => ' + colors.magenta('--watch') + ' option set to true => background watcher will be started that will');
    console.log('\t' + '    listen for changes to any file in your ' + colors.blue(' "' + testDir + '" ') + ' directory');

    if (!global.sumanOpts.sparse) {
      console.log('\t => ' + colors.magenta(' --all') + ' option used which always tells Suman to work with ' +
        'the directory specified by the "testDir" property in your config.');
    }

    if (opts.transpile) {
      console.log('\t' + ' => Files will be transpiled to  ' + colors.blue(' "' + targetDir + '" '));
    }
    if (opts.transpile && opts.no_run) {
      console.log('\t => However, since the --no-run option was used, the watcher will only transpile files but not run them.');
    }
    else {
      console.log('\t => Suman will execute any test file that experiences changes observed by the watch process.');
    }
  }

  if (opts.all) {
    paths = [ testDir ]
  }
  else {
    if (paths.length < 1) {
      return finish(new Error('No paths argument(s) for watching => If you wish to watch all files, use the --all option, \n    otherwise pass in' +
        ' an argument pertaining to which file or directory you wish to watch.'));
    }
    paths = paths.map(function (p) {
      return path.resolve(path.isAbsolute(p) ? p : (projectRoot + '/' + p));
    });
  }

  if (opts.verbose) {
    console.log('Suman will send the following paths to Suman server watch process:', paths);
  }

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

      socketio('http://' + val.host + ':' + val.port)

        .on('connect', function () {

          if (opts.verbose) {
            console.log('\n', 'Web-socket connection to Suman server successful.', '\n');
          }

          if (process.env.SUMAN_DEBUG === 'yes') {
            console.log(' => Suman about to send watch message to Suman server =>', '\n', util.inspect(opts));
          }

          this.emit('watch', JSON.stringify({
            paths: paths,
            transpile: opts.transpile,
            executeTests: !!opts.no_run
          }));

          setImmediate(finish);

        }).on('connect_timeout', function (err) {

        console.log(' => Suman server connection timeout :(');
        setTimeout(function () {
          finish(new Error('connect_timeout' + (err.stack || err || '')));
        }, 500);

      }).on('connect_error', function (err) {

        if (runErrors) {
          console.log(' => Suman server "connect_error":', err.stack);
          setTimeout(function () {
            finish(err);
          }, 5000);
        }

      }).on('error', function (err) {

        console.log('\n => Suman server connection "error":', err.stack);
        console.log('\n\n => Please check your logs/server.log file for more info.');

        setTimeout(function () {
          finish(err);
        }, 500);

      });
    }

  });

}

module.exports = watch;