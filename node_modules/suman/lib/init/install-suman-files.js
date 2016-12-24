'use striiict';


//core
const cp = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const util = require('util');

//npm
const async = require('async');
const colors = require('colors/safe');
const chmodr = require('chmodr');
const debug = require('suman-debug');

//project
const constants = require('../../config/suman-constants');
const sumanUtils = require('suman-utils/utils');
const debugInit = debug('s:init');


/////////////////////////////////////////////////////////////////////////////

module.exports = function (data) {

  const newSumanHelperDirAbsPath = data.newSumanHelperDirAbsPath;
  const prependToSumanConf = data.prependToSumanConf;
  const newSumanHelperDir = data.newSumanHelperDir;
  const projectRoot = data.projectRoot;


  debugInit(' => Calling create suman files routing with this data => ', data);

  return function installSumanFiles(cb) {

    async.series([
      function (cb) {
        if (true) {
          // => we won't ever delete files from project, too dangerous
          process.nextTick(cb);
        }
        else {
          cp.exec('cd ' + projectRoot + '&& rm -rf suman', function (err, stdout, stderr) {
            if (err || String(stdout).match(/error/i) || String(stderr).match(/error/)) {
              cb(err || stdout || stderr);
            }
            else {
              cb(null);
            }
          });
        }

      },
      function (cb) {
        //if dir exists an error will be thrown
        debugInit(' => Making new suman dir here => ', newSumanHelperDirAbsPath);
        fs.mkdir(newSumanHelperDirAbsPath, 0o777, cb);
      },
      function (cb) {
        async.parallel([
          function (cb) {
            async.each([  //formerly async.map
              {
                src: 'default-conf-files/suman.default.conf.js',
                dest: prependToSumanConf + 'suman.conf.js'
              },
              {
                src: 'default-conf-files/suman.default.reporters.js',
                dest: newSumanHelperDir + '/suman.reporters.js'
              },
              {
                src: 'default-conf-files/suman.default.ioc.js',
                dest: newSumanHelperDir + '/suman.ioc.js'
              },
              {
                //TODO: suman.order.js should be suman.constaints.js ?
                src: 'default-conf-files/suman.default.order.js',
                dest: newSumanHelperDir + '/suman.order.js'
              },
              {
                src: 'default-conf-files/suman.default.once.js',
                dest: newSumanHelperDir + '/suman.once.js'
              },
              {
                src: 'default-conf-files/suman.default.globals.js',
                dest: newSumanHelperDir + '/suman.globals.js'
              },
              {
                src: 'default-conf-files/suman.default.hooks.js',
                dest: newSumanHelperDir + '/suman.hooks.js'
              },
              {
                src: 'default-conf-files/suman.default.readme',
                dest: newSumanHelperDir + '/.readme'
              }

            ], function (item, cb) {

              debugInit(' => Writing new file with this info => ', item);

              fs.createReadStream(path.resolve(__dirname, '..', item.src))
                .pipe(fs.createWriteStream(path.resolve(projectRoot + '/' + item.dest)))
                .once('error', cb).once('finish', cb);

            }, cb);
          },
          function (cb) {

            const gitignore = path.resolve(projectRoot + '/.gitignore');
            fs.readFile(gitignore, function (err, data) {
              if (err && !String(err.stack || err).match(/ENOENT/i)) {
                return cb(err);
              }
              async.each(constants.GIT_IGNORE, function (item, cb) {
                if (String(data).indexOf(item) > -1) {
                  debugInit(' => Item was already in .gitignore file => ', item, data);
                  process.nextTick(cb);
                }
                else {
                  debugInit(' => Appending item to .gitignore file => ', item);
                  fs.appendFile(gitignore, item, cb);
                }
              }, cb);

            });

          },
          function (cb) {
            fs.mkdir(path.resolve(newSumanHelperDirAbsPath + '/examples'), 0o777, function (err) {
              if (err) {
                if (!String(err).match(/EEXIST/)) {
                  return cb(err);
                }
              }
              else {

                const p = path.resolve(__dirname + '/../../file-examples');

                fs.readdir(p, function (err, items) {
                  if (err) {
                    cb(err);
                  }
                  else {

                    async.each(items, function (item, cb) {
                      fs.createReadStream(path.resolve(p + '/' + item))
                        .pipe(fs.createWriteStream(path.resolve(newSumanHelperDirAbsPath + '/examples/' + item)))
                        .once('error', cb).once('finish', cb);
                    }, cb);
                  }
                });
              }

            });
          },
          function (cb) {
            fs.mkdir(path.resolve(newSumanHelperDirAbsPath + '/logs'), 0o777, function (err) {
              if (err) {
                if (!String(err).match(/EEXIST/)) {
                  return cb(err);
                }
              }
              //we also just overwrite stdio logs
              const msg1 = 'Readme file here primarily for version control stability\n';
              const msg2 = 'Suman recommends that you tail the files in this directory when you\'re developing tests => most useful thing to do is to tail the runner-debug.log when running tests with the Suman runner,' +
                'this is because accessing the individual test errors is less transparent due to the nature of child-processes/subprocesses)';
              const msg3 = msg1 + '\n' + msg2;

              async.forEachOf([
                '.readme',
                'watcher-output.log',
                'test-debug.log',
                'server.log',
                'runner-debug.log'
              ], function (item, index, cb) {
                fs.writeFile(path.resolve(newSumanHelperDirAbsPath + '/logs/' + item), index === 0 ? msg3 : msg2, cb);
              }, cb);
            });
          }
        ], cb);
      },
      function chownDirs(cb) {
        // cp.exec('cd ' + root + ' && chown -R $(whoami) suman', cb);
        chmodr(newSumanHelperDirAbsPath, 0o777, cb);
      }
    ], cb);
  }

};
