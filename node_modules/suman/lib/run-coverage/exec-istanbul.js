'use striiict';

//core
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const os = require('os');
const util = require('util');

//npm
const colors = require('colors/safe');
const async = require('async');

//project
const sumanUtils = require('suman-utils/utils');

module.exports = function (dirs, isRecursive) {

  const opts = global.sumanOpts;
  const coverageDir = path.resolve(global.projectRoot + '/coverage');

  const files = [];

  dirs.forEach(function (dir) {

    (function findFiles (dir, isFile) {

      if (isFile) {
        const basename = path.basename(dir);
        if (path.extname(basename) === '.js') {
          files.push(dir);
        }
      }
      else {

        if (fs.statSync(dir).isFile()) {
          findFiles(dir, true);
        }
        else {
          var items = fs.readdirSync(dir);

          items.forEach(function (item) {

            item = path.resolve(dir + '/' + item);

            if (fs.statSync(item).isFile()) {
              findFiles(item, true);
            }
            else {
              if (isRecursive) {
                findFiles(item, false);
              }
            }

          });
        }

      }

    })(dir);

  });

  //TODO: use --include-all-sources
  // as per http://stackoverflow.com/questions/27606071/how-to-make-istanbul-generate-coverage-for-all-of-my-source-code
  //istanbul report --dir coverage --include **/*coverage.json json
  //istanbul report --dir coverage --include **/*coverage.json json

  console.log(' => Suman message => the following shell commands will run on your system and may take awhile.');
  console.log(' => Suman message => please be patient.\n\n');
  console.log(' => Because collecting coverage is more CPU intensive, we run one suman test command at a time.');

  var istanbulInstallPath;
  var executable;
  // try {
  //   istanbulInstallPath = require.resolve(path.resolve(projectRoot + '/node_modules/istanbul'));
  //   executable = path.resolve(projectRoot + '/node_modules/.bin/istanbul');
  //   if (opts.verbose) {
  //     console.log(' => Suman verbose message => install path of instabul => ', istanbulInstallPath);
  //   }
  // }
  // catch (e) {
  //   if (!opts.force) {
  //     console.log('\n', ' => Suman message => Looks like istanbul is not installed locally, you can run "$ suman --use-istanbul", to acquire the right deps.');
  //     console.log('\n', ' => Suman message => If installing "istanbul" manually, you may install locally or globally, Suman will pick it up either way.');
  //     console.log('\t => To override this, use --force.', '\n');
  //     return;
  //   }
  //   else {
  //     executable = 'istanbul';
  //   }
  // }

  try {
    istanbulInstallPath = require.resolve(path.resolve(projectRoot + '/node_modules/istanbul'));
    executable = path.resolve(projectRoot + '/node_modules/.bin/istanbul');
    if (opts.verbose) {
      console.log(' => Suman verbose message => install path of instabul => ', istanbulInstallPath);
    }
  }
  catch (e) {
    if (!opts.force) {
      console.log('\n', ' => Suman message => Looks like istanbul is not installed locally, you can run "$ suman --use-istanbul", to acquire the right deps.');
      console.log('\n', ' => Suman message => If installing "istanbul" manually, you may install locally or globally, Suman will pick it up either way.');
      console.log('\t => To override this, use --force.', '\n');
      return;
    }
    else {
      executable = 'istanbul';
    }
  }

  console.log(' => Istanbul executable => ' + executable);

  const bash = [];
  const cmd = [];

  if (global.sumanOpts.verbose) {
    console.log(' => Suman verbose message => Files to be covered by istanbul:');
    var noFiles = true;
    files.forEach(function (f, i) {
      noFiles = false;
      console.log('\t', i + 1, ' => ' + f);
    });
    if (noFiles) {
      console.log('\t\t(in fact, no files will be covered by istanbul, we are done here.)');
      return;
    }
  }

  const $files = sumanUtils.removeSharedRootPath(files);

  $files.forEach(function (file) {

    if (String(file[ 1 ]).endsWith('.js')) {
      file[ 1 ] = String(file[ 1 ]).substring(0, String(file[ 1 ]).length - 3);
    }

    //note we replace path.sep with dash
    //TODO: need to use path.sep instead of plain /
    if (os.platform() === 'win32') {
      cmd.push('temp');
    }
    else {
      // bash += executable + ' cover ' + file[ 0 ] + ' --dir ./coverage/' + String(path.basename(file[ 1 ], '.js')).replace(/\//g, '-') + '; \n';
      // bash += executable + ' cover ' + file[ 0 ] + ' --dir ./coverage/' + String(file[ 1 ]).replace(/\//g, '-') + '; \n';

      const tempConverageDir = path.resolve(coverageDir + '/' + String(file[ 1 ]).replace(/\//g, '-'));
      bash.push([ 'cover', file[ 0 ], '--dir', tempConverageDir, '--report', 'lcov' ]);
    }

  });

  //TODO: turn this into spawn instead of exec?

  async.parallel({

    runner: function (cb) {

      if (!global.sumanOpts.library_coverage) {
        return process.nextTick(cb);
      }
      const cmd = './node_modules/.bin/suman --concurrency=3 --cwd-is-root --library-coverage --runner ' + files.join(' ');

      const argz = String(cmd).split(/\s+/);

      if (process.env.SUMAN_DEBUG === 'yes') {
        console.log(' => Suman coverage command =>\n' + colors.magenta(argz.map(i => '\n' + i)));
      }

      const n = cp.spawn('node', argz, {});

      n.stdout.setEncoding('utf8');
      n.stderr.setEncoding('utf8');

      n.stdout.on('data', function (d) {
        console.log(d);
      });

      n.stderr.on('data', function (d) {
        console.log(d);
      });

      n.on('close', function (code) {
        cb(null, code);
      });

    },

    individual: function (cb) {

      if (os.platform() === 'win32') {
        console.error(' => Suman warning => Windows not implemented yet.');
        return process.nextTick(cb);
      }

      async.mapLimit(bash, 5, function (item, cb) {

        console.log('item => ', item);
        const n = cp.spawn(executable, item, {});

        n.stdout.setEncoding('utf8');
        n.stderr.setEncoding('utf8');

        n.stdout.on('data', function (d) {
          console.log(d);
        });

        n.stderr.on('data', function (d) {
          console.log(d);
        });

        n.on('close', function (code) {
          cb(null, code);
        });

      }, function (err, results) {
        if (err) {
          console.error(err.stack || err);
        }
        console.log('results => ', results);
        cb(null);
      });

    }

  }, function (err, results) {

    if (err) {
      console.error(err.stack || err);
    }

    cp.exec('cd ' + global.projectRoot + ' && istanbul report --dir ' + coverageDir + ' --include **/*coverage.json lcov', function (err, stdout, stderr) {
      if (err) {
        console.error(err.stack || err);
        return process.exit(1);
      }
      else {
        return process.exit(0);
      }
    });

  });

  //TODO: implement with spawn instead of exec

};
