//core
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

//npm
const async = require('async');

/////////////////////////////////////////////////////////////

const installsGroupA = [
  'install',
  '--save-dev',
  'webpack',  // => supposedly needed by babel-loader
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
  'babel-preset-stage-3'
];

module.exports = function initBabelLocally(data, cb) {

  if (process.env.SUMAN_DEBUG === 'yes') {
    console.log('"data" pass to initBabelLocally =>', util.inspect(data));
  }

  const root = global.projectRoot;

  console.log(' => Installing the correct Babel dependencies in your local project.');

  if (!global.sumanOpts.force && !process.env.SUDO_UID) {
    console.log('You may wish to run the the commmand with root permissions, since you are installing globally');
    console.log(' => if using "sudo" makes you unhappy, try "# chown -R $(whoami) $(npm root -g) $(npm root) ~/.npm"');
    console.log(' => To override this message, use --force\n');
    return;
  }

  console.log(' => Installing/updating Babel may take awhile, it may be a good time to take a break.');

  const i = setInterval(function () {
    process.stdout.write('.');
  }, 500);

  async.parallel([
      function (cb) {
        fs.readFile(path.resolve(__dirname, '..', 'default-conf-files', '.default-babelrc'), function (err, data) {
          if (err) {
            cb(err);
          }
          else {
            fs.writeFile(path.resolve(root + '/.babelrc'), data, {flag: 'wx'}, function (err) {
              if (err && String(err.stack).match(/eexist/i)) {
                fs.writeFile(path.resolve(root + '/.suman-babelrc'), data, {flag: 'wx'}, function (err) {
                  if (err && !String(err.stack).match(/eexist/i)) {
                    cb(err);
                  }
                  else {
                    cb(null);
                  }
                });
              }
              else if (err) {
                cb(err);
              }
              else {
                cb(null);
              }
            });
          }

        });
      },
      function (cb) {
        const n = cp.spawn('npm', installsGroupA);

        n.on('close', function () {
          n.kill();
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
    ],
    function (err) {
      if (err) {
        console.log('\n', colors.bgRed.white(' => Error => Babel was *not* installed successfully =>'), '\n', err.stack || err);
        process.exit(1);
      }
      else {
        console.log('\n', colors.bgBlue.white.bold('Babel was installed successfully into your local project.'), '\n');
        console.log('\n', colors.bgBlue.white.bold(' => To learn about how to use Babel with Suman, visit ***.'), '\n');
        process.exit(0);
      }
    });

};
