'use strict';

//core
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const domain = require('domain');
const util = require('util');
const cp = require('child_process');

//npm
const async = require('async');
const _ = require('lodash');
const colors = require('colors/safe');
const sumanUtils = require('suman-utils/utils');
const rimraf = require('rimraf');
const events = require('suman-events');
const debug = require('suman-debug')('s:cli');

//project
const noFilesFoundError = require('./helpers/no-files-found-error');
const ascii = require('./helpers/ascii');
const constants = require('../config/suman-constants');
const makeNetworkLog = require('./make-network-log');
const findSumanServer = require('./find-suman-server');
const resultBroadcaster = global.resultBroadcaster = (global.resultBroadcaster || new EE());

//////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = function (opts, paths, sumanServerInstalled, sumanVersion) {

  debugger;  //leave here forever so users can easily debug

  const projectRoot = global.projectRoot;
  const timestamp = global.timestamp = Date.now();
  const networkLog = global.networkLog = makeNetworkLog(timestamp);
  const server = global.server = findSumanServer(null);
  const testDir = process.env.TEST_DIR;
  const testSrcDir = process.env.TEST_SRC_DIR;
  const testTargerDir = process.env.TEST_TARGET_DIR;
  const makeSumanLog = process.env.MAKE_SUMAN_LOG = 'yes';
  const ssp = process.env.SUMAN_SINGLE_PROCESS;

  // make sure we are not issuing Suman command from wrong directory
  // this should get refactored into runner get-file-paths.js
  require('./helpers/vet-paths')(paths);

  function checkStatsIsFile(item) {

    debug([' => SUMAN_DEBUG => checking if "' + item + '" is a file.']);

    try {
      return fs.statSync(item).isFile();
    }
    catch (err) {
      if (opts.verbose) {
        console.error(' => Suman verbose warning => ', err.stack);
      }
      return null;
    }
  }


  var originalPaths = null;
  var originalPathsMappedToTranspilePaths = null;

  debug(' => transpiling? => ', opts.transpile);
  debug(' => useBabelRegiser ? => ', opts.useBabelRegister);

  if (paths.length < 1) {
    if (testSrcDir) {
      paths = [testSrcDir];
    }
    else {
      throw new Error(' => Suman usage error => No "testSrcDir" prop specified in config or by command line.');
    }
  }


  async.parallel({

    rimrafLogs: function (cb) {

      const sumanCPLogs = path.resolve(global.sumanHelperDirRoot + '/logs/tests');
      rimraf(sumanCPLogs, function (err) {
        if (err) {
          cb(err);
        }
        else {
          fs.mkdir(sumanCPLogs, 0o777, cb);
        }
      });

    },
    npmList: function (cb) {

      return process.nextTick(cb);

      //TODO: this was causing problems, skip for now
      var callable = true;

      const to = setTimeout(first, 800);

      function first() {
        if (callable) {
          clearTimeout(to);
          callable = false;
          cb.apply(null, arguments);
        }
      }

      const n = cp.spawn('npm', ['view', 'suman', 'version'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      n.on('close', first);

      n.stdout.setEncoding('utf8');
      n.stderr.setEncoding('utf8');

      n.stdout.on('data', function (data) {
        const remoteVersion = String(data).replace(/\s+/, '');
        const localVersion = String(sumanVersion).replace(/\s+/, '');
        if (callable && remoteVersion !== localVersion) {
          console.log(colors.red(' => Newest Suman version in the NPM registry:', remoteVersion, ', current version =>', localVersion));
        }
        else {
          console.log(colors.red(' => Good news, your Suman version is up to date with latest version on NPM'));
        }
      });

      n.stderr.on('data', function (data) {
        console.error(data);
      });

    },

    slack: function (cb) {

      var callable = true;
      const first = function () {
        if (callable) {
          callable = false;
          cb.apply(null, arguments);
        }
      };

      var slack;
      try {
        slack = require('slack');
      }
      catch (err) {
        debug(err.stack);
        return process.nextTick(first);
      }

      const to = setTimeout(function () {
        first(null);
      }, 200);

      slack.chat.postMessage({

        token: process.env.SLACK_TOKEN,
        channel: '#suman-all-commands',
        text: JSON.stringify({
          command: process.argv,
          config: global.sumanConfig
        })

      }, (err, data) => {
        clearTimeout(to);
        if (err) {
          debug(err.stack || err);
        }
        first(null);
      });
    },

    transpileFiles: function (cb) {

      if (opts.transpile && !opts.useBabelRegister) {
        require('./transpile/run-transpile')(paths, opts, cb);
      }
      else {
        process.nextTick(cb);
      }
    },

    getFilesToRun: function (cb) {

      //TODO: get-file-paths should become async, not sync
      require('./runner-helpers/get-file-paths')(paths, opts, cb);

    },

    conductStaticAnalysisOfFilesForSafety: function (cb) {
      if (false && opts.safe) {
        cb(new Error('safe option not yet implemented'));
      }
      else {
        process.nextTick(cb);
      }
    },

    acquireLock: function (cb) {
      networkLog.createNewTestRun(server, cb);
    }

  }, function complete(err, results) {

    if (err) {
      console.error('\n\n => Suman fatal pre-run problem => ' + (err.stack || err), '\n\n');
      return process.exit(1);
    }

    if (opts.vverbose) {
      console.log('=> Suman vverbose message => "$ npm list -g" results: ', results.npmList);
    }

    function changeCWDToRootOrTestDir(p) {
      if (opts.cwd_is_root) {
        process.chdir(projectRoot);
      }
      else {
        process.chdir(path.dirname(p));  //force CWD to test file path // boop boop
      }
    }

    debug([' => results => ', results]);
    debug([' => results.getFilesToRun => ', results.getFilesToRun]);
    debug([' => results.transpileFiles => ', results.transpileFiles]);

    const obj = results.getFilesToRun;

    var files = obj.files;
    const nonJSFile = !!obj.nonJSFile;

    // note: safeguard in case something really weird happened, might want to do a big data dump here
    if (files.length < 1) {
      return noFilesFoundError(paths);
    }

    const d = domain.create();

    d.once('error', function (err) {
      //TODO: add link showing how to set up Babel
      console.error(colors.magenta(' => Suman fatal error (domain caught) => \n' + (err.stack || err) + '\n'));
      process.exit(constants.RUNNER_EXIT_CODES.UNEXPECTED_FATAL_ERROR);
    });


    resultBroadcaster.emit(events.RUNNER_TEST_PATHS_CONFIRMATION,
      ['\n ' + colors.bgBlack.white.bold(' Suman will attempt to execute test files with/within the following paths: '),
        '\n\n',
        files.map((p, i) => '\t ' + (i + 1) + ' => ' + colors.cyan('"' + p + '"')).join('\n') + '\n\n\n'].join(''));

    if (opts.vverbose) {
      console.log(' ', colors.bgCyan.magenta(' => Suman verbose message => ' +
        'Suman will execute test files from the following locations:'), '\n', files, '\n');
    }

    //TODO: if only one file is used with the runner, then there is no possible blocking,
    // so we can ignore the suman.order.js file,
    // and pretend it does not exist.

    if (opts.coverage) {
      require('./run-coverage/exec-istanbul')(files, opts.recursive);
    }
    else if (ssp === 'yes' && !opts.runner) {

      console.log(ascii.suman_slant, '\n');
      d.run(function () {
        process.nextTick(function () {
          changeCWDToRootOrTestDir(projectRoot);

          if (opts.rand) {
            files = _.shuffle(files);
          }
          global.sumanSingleProcessStartTime = Date.now();
          require('./run-child-not-runner')(sumanUtils.removeSharedRootPath(files));
        });
      });
    }
    else if (!opts.runner && files.length === 1 && checkStatsIsFile(files[0]) && nonJSFile == false) {

      console.log(ascii.suman_slant, '\n');
      //TODO: we could read file in (fs.createReadStream) and see if suman is referenced
      d.run(function () {
        process.nextTick(function () {
          changeCWDToRootOrTestDir(files[0]);
          require('./run-child-not-runner')(files);
        });
      });
    }
    else {

      const sumanRunner = require('./create-suman-runner');

      d.run(function () {
        process.nextTick(function () {
          sumanRunner({

            $node_env: process.env.NODE_ENV,
            runObj: obj

          }).on('message', function (msg) {
            //TODO: one day runner might be in separate processs, maybe on separate machine, who knows
            console.log(' => Messsage from suman runner', msg);
          });
        });
      });
    }

  });
};
