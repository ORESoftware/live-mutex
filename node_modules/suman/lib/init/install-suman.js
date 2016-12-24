'use striiict';


//core
const cp = require('child_process');
const os = require('os');

//npm
const colors = require('colors/safe');
const chmodr = require('chmodr');

//project
const constants = require('../../config/suman-constants');
const sumanUtils = require('suman-utils/utils');
const debug = require('suman-debug')('s:init');


/////////////////////////////////////////////////////////////////////////////

module.exports = function (data) {

  const resolvedLocal = data.resolvedLocal;
  const pkgDotJSON = data.pkgDotJSON;
  const projectRoot = data.projectRoot;

  return function npmInstall(cb) {

    if (global.sumanOpts.no_install || resolvedLocal) {
      if (resolvedLocal) {
        console.log('\n\n');
        console.log(colors.magenta(' => Suman is already installed locally ( v' + pkgDotJSON.version + '),' +
          ' to install to the latest version on your own, use =>', '\n',
          ' "$ npm install -D suman@latest"'));
      }
      process.nextTick(cb);
    }
    else {

      console.log(' => Suman message => Installing suman locally...using "npm install -D suman"...');
      const envObj = {};

      envObj.SUMAN_POSTINSTALL_IS_DAEMON = global.sumanOpts.daemon ? 'yes' : undefined;

      const sumanUrl = (true || process.env.SUMAN_META_TEST === 'yes') ? 'github:oresoftware/suman#dev' : 'suman@latest';

      const s = cp.spawn('npm', ['install', '--production', '--only=production', '--loglevel=warn', '-D', sumanUrl], {
        cwd: projectRoot,
        env: Object.assign({}, process.env, envObj)
      });

      s.stdout.setEncoding('utf8');
      s.stderr.setEncoding('utf8');

      var i;

      if(false){
         i = setInterval(function () {
          process.stdout.write('.');
        }, 500);
        s.stdout.on('data', d => {
          debug(d);
        });
      }
      else{
        s.stdout.on('data', d => {
          console.log(d);
        });
      }


      var first = true;
      s.stderr.on('data', d => {
        if (first) {
          first = false;
          clearInterval(i);
          console.log('\n');
        }
        console.error(String(d));
      });

      s.on('close', (code) => {
        clearInterval(i);
        if (code > 0) {  //explicit for your pleasure
          cb(null, ' => Suman installation warning => NPM install script exited with non-zero code: ' + code + '.')
        }
        else {
          cb(null);
        }

      });
    }

  }


};
