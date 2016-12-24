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

module.exports = function (istanbulInstallPath, dirs, isRecursive) {

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

  var bash = 'echo "';
  var cmd = '';

  var executable;

  //here we handle if istanbul is installed locally instead of globally
  if (istanbulInstallPath) {
    // const p = String(istanbulInstallPath).split(path.sep);
    // p.pop();
    // p.push('lib');
    // p.push('cli');
    // executable = 'node ' + path.resolve(p.join(path.sep));

    executable = './node_modules/.bin/istanbul';

    console.log(' => Istanbul executable => ' + executable);
  }
  else {
    executable = 'istanbul';
  }

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
      cmd += executable + ' cover ' + path.normalize(file[ 0 ]) + ' --dir ./coverage/' + String(path.basename(path.normalize(file[ 1 ]), '.js')).replace(/\//g, '-') + ' & ';
    }
    else {
      // bash += executable + ' cover ' + file[ 0 ] + ' --dir ./coverage/' + String(path.basename(file[ 1 ], '.js')).replace(/\//g, '-') + '; \n';
      bash += executable + ' cover ' + file[ 0 ] + ' --dir ./coverage/' + String(file[ 1 ]).replace(/\//g, '-') + '; \n';
    }

  });

  //we pipe through bash to avoid writing out temp file(s)
  if (os.platform() === 'win32') {
    cmd += executable + ' report --dir coverage --include **/*coverage.json lcov';
    if (global.sumanOpts.verbose) {
      console.log('\n\n', ' => Suman verbose message =>', ' for your reference, the windows shell command utilized for test coverage is as follows:\n', cmd);
    }

  }
  else {
    // bash += executable + ' report --dir coverage --include **/*coverage.json lcov" | bash';
    bash += '" | bash';
    if (global.sumanOpts.verbose) {
      console.log('\n\n', ' => Suman verbose message =>', ' for your reference, the bash command utilized for test coverage is as follows:\n', bash);
    }
  }

  console.log(' => Istanbul script =>\n', colors.cyan(util.inspect(bash)));

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

      n.on('close', cb);

    },

    individual: function (cb) {


      cp.exec(os.platform() === 'win32' ? cmd : bash, function (err, stdout, stderr) {

        if (err) {
          console.error(err.stack);
        }

        console.log('Stdout:', stdout);
        console.error('Stderr:', stderr);

        cb(null);

      });

    }

  }, function (err, results) {

    if (err) {
      console.error(err.stack || err);
    }

    cp.exec('cd ' + global.projectRoot + '&& istanbul report --dir ' + coverageDir + ' --include **/*coverage.json lcovonly', function (err, stdout, stderr) {
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

  // const arr = bash.split(/\s+/g);
  // console.log('aaarray:',arr);
  //
  // var ls;
  // if(os.platform() === 'win32'){
  //      ls = cp.spawn('ls', ['-lh', '/usr']);
  // }
  // else{
  //      ls = cp.spawn('bash', arr );
  // }
  //
  //
  // ls.stdout.on('data', (data) => {
  //     console.log(`stdout: ${data}`);
  // });
  //
  // ls.stderr.on('data', (data) => {
  //     console.log(`stderr: ${data}`);
  // });
  //
  // ls.on('close', (code) => {
  //     console.log(`child process exited with code ${code}`);
  // });

};