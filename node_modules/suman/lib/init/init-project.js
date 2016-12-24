'use striiiict';

//core
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
// const spawn = require('cross-spawn');
const os = require('os');

//npm
const async = require('async');
const _ = require('lodash');
const colors = require('colors/safe');
const chmodr = require('chmodr');
const semver = require('semver');

//project
const makeGetLatestSumanVersion = require('./get-latest-suman-version');
const makeNPMInstall = require('./install-suman');
const writeSumanFiles = require('./install-suman-files');
const determineIfReadlinkAvail = require('./determine-if-readlink-avail');
const makeAppendToBashProfile = require('./append-to-bash-profile');
const constants = require('../../config/suman-constants');
const sumanUtils = require('suman-utils/utils');
const helpers = require('./init-helpers');
const debug = require('suman-debug')('s:init');


/////////////////////////////////////////////////////////////////////////////////////////////////

const logPermissonsAdvice = helpers.logPermissonsAdvice;

////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = opts => {

  const force = opts.force;
  const fforce = opts.fforce;

  console.log('\n\n',' => Debugging with SUMAN_DEBUG? => ', !!process.env.SUMAN_DEBUG,
    ' => SUMAN_DEBUG = ', process.env.SUMAN_DEBUG,'\n');

  debug(' => In the beginning of the init routine => opts are => ', opts);

  const cwd = process.cwd();
  const projectRoot = global.projectRoot;

  if (!projectRoot) {
    console.log(colors.red('\n => Suman installation fatal error => Suman cannot find the root of your project given your current working directory.\n' +
      'Please ensure that you are issuing the installation command from the root of your project.\n' +
      'You will need to run "$ npm init" if your project does not have a package.json file yet.\n\n'));
    return;
  }

  if (!force && !process.env.SUDO_UID) {
    logPermissonsAdvice();
  }

  //TODO: we need to install babel globally
  //TODO: we need to make sure that root contains package.json file, otherwise tell them they should run npm init first

  var err;

  try {
    require(path.resolve(cwd + '/package.json'));
  }
  catch (err) {
    if (!fforce) {
      console.log(' => Suman message => there is no package.json file in your working directory.');
      console.log(' => Perhaps you wish to run ' + colors.yellow('"$ npm init"') + ' first, or perhaps you are in the wrong directory?');
      console.log(' => To override this use the --fforce option.');

      if (projectRoot) {
        console.log('\nIn other words, the current working directory is as follows:');
        console.log(colors.cyan(cwd));
        console.log('...but the root of your project appears to be at this path:');
        console.log(colors.magenta(projectRoot), '\n\n');
      }

      return;
    }
  }

  var resolved = false;
  var resolvedLocal = false;
  var pkgDotJSON;

  try {
    //TODO: what if it recognizes global modules as well as local ones?
    require.resolve('suman');
    resolved = true;
    pkgDotJSON = require(path.resolve(projectRoot + '/node_modules/suman/package.json'));
    resolvedLocal = true;
  }
  catch (e) {
    err = e;
  }

  if (err) {
    console.log(' => Suman message => Suman will attempt to install itself to the project in your current working directory.');
  }
  else {
    //TODO: only write out suman.x.js if it doesn't already exist
    if (!force && !fforce) {
      console.log(' => Suman init message => Suman NPM package is already installed locally.');
      console.log(colors.magenta(' => Use the --force option to update to the latest version', '\n\n'));
      // return;
    }
  }

  var conf,
    timestamp = String(Date.now()),
    prependToSumanConf = '',
    appendToSumanHelpersDir = '',
    sumanHelperDirFound = false,
    sumanAlreadyInittedBecauseConfFileExists = false;

  var potentialPathToConf;
  try {
    potentialPathToConf = path.resolve(projectRoot + '/suman.conf.js');
    conf = require(potentialPathToConf);
    sumanAlreadyInittedBecauseConfFileExists = true;
    debug(' => During --init, we have found a pre-existing suman.conf.js file at path ' +
      'file at path => ', potentialPathToConf);
  }
  catch (err) {
    debug(' => Did not find a suman.conf.js (a good thing, since we are initting) ' +
      'file at path => ', potentialPathToConf || (' => implementation error => ' + (err.stack || err)));
  }

  try {
    if (!fforce) {
      const p = path.resolve(projectRoot + '/' + (conf ? (conf.sumanHelpersDir || '/suman') : '/suman' ));
      console.log(' => Looking for existing suman helpers dir here => "' + p + '"');
      const files = fs.readdirSync(p);
      sumanHelperDirFound = true;
      files.forEach(function (file) {
        if (!sumanAlreadyInittedBecauseConfFileExists) {
          sumanAlreadyInittedBecauseConfFileExists = true;
          console.log(colors.magenta.bold(' => Looks like this project has already ' +
            'been initialized as a Suman project.'));
        }
        console.log(' => Your ./suman directory already contains => ' + file);
      });
    }

  }
  catch (err) {
    console.error(' => Could not find your suman helpers dir => We will create a new one.');
  }

  // if (sumanAlreadyInittedBecauseConfFileExists && !fforce) {
  //   console.log(' => Looks like Suman has already been initialized in this project - ' + (force ? 'and you used the --force option,' : '') + ' do you want to re-initialize Suman in this project?');
  //   console.log(colors.cyan(' => If you would like to truly overwrite your current Suman files with the latest defaults, you can re-run "$ suman --init" with the --fforce option (not a typo).'));
  //   console.log(colors.red(' => Before you use --force/--fforce options, it\'s always a good idea to run a commit with your version control system.') + '\n\n');
  //   console.log(colors.red(' => Should you choose to reinitialize, Suman will write out folders with a timestamp for uniqueness.'));
  //   return;
  // }

  if (sumanAlreadyInittedBecauseConfFileExists && !force) {
    console.log(' => Looks like Suman has already been initialized in this project ' +
      '- do you want to re-initialize Suman in this project?');
    console.log(colors.cyan(' => If you would like to install the latest Suman files with the latest defaults, ' +
      'you can re-run "$ suman --init" with the --force option.'));
    console.log(colors.red(' => Before you use --force/--fforce options, it\'s always a good idea to run a commit with your version control system.') + '\n');
    console.log(colors.red.bold(' => Should you choose to reinitialize, Suman will write out folders with a timestamp for uniqueness, and will not delete' +
      ' any of your files. It is very safe to reinitialize Suman.'),'\n\n');
    return process.exit(1);
  }

  if (sumanAlreadyInittedBecauseConfFileExists) {
    prependToSumanConf = timestamp + '-';
  }

  if (sumanHelperDirFound) {
    appendToSumanHelpersDir = '-' + timestamp;
  }

  const newSumanHelperDir = '/suman' + appendToSumanHelpersDir;
  const newSumanHelperDirAbsPath = path.resolve(projectRoot + '/suman' + appendToSumanHelpersDir);

  async.series({

    installFiles: function (cb) {

      debug(' => Running installFiles in parallel...');

      async.parallel({

        installSumanFiles: writeSumanFiles({
          newSumanHelperDirAbsPath: newSumanHelperDirAbsPath,
          prependToSumanConf: prependToSumanConf,
          newSumanHelperDir: newSumanHelperDir,
          projectRoot: projectRoot
        }),

        getLatestSumanVersion: makeGetLatestSumanVersion({
          pkgDotJSON: pkgDotJSON
        }),

        determineIfReadlinkIsAvailable: determineIfReadlinkAvail({}),
        appendToBashProfile: makeAppendToBashProfile({})


      }, cb);

    },

    npmInstall: makeNPMInstall({
      projectRoot: projectRoot,
      resolvedLocal: resolvedLocal,
      pkgDotJSON: pkgDotJSON
    })

  }, function (err, results) {

    _.flattenDeep(results).forEach(function (item) {
      if (item) {
        console.log('\n' + colors.bgYellow.black(item) + '\n');
      }
    });

    if (err) {
      console.error('\n => Suman fatal installation error => ', (err.stack || err));
      logPermissonsAdvice();
      return process.exit(1);
    }
    else if (results.npmInstall) {
      console.log(colors.bgYellow.black.bold(' => Suman message => NPM error, most likely a permissions error.') + '\n\n');
      logPermissonsAdvice();
    }
    else {
      console.log('\n\n',
        colors.bgBlue.white.bold(' => Suman message => Suman was successfully installed locally.'), '\n\n');
    }

    console.log([ '=> Notice the new directory called "suman" in the root of your project.',
      'This directory houses log files used by Suman for debugging tests running',
      'in child processes as well as Suman helper files. Suman recommends moving the ',
      '"suman" directory inside your <test-dir> and renaming it "_suman" or ".suman".',
      'If you elect this option, you should change your suman.conf.js file according to these instructions:',
      ' => http://oresoftware.github.io/suman/tutorial-01-getting-started.html' ].map((l, index, a) => {
      return (index < a.length - 1) ? colors.bgBlack.cyan(l) : colors.bgBlack.yellow(l);
    }).join('\n'), '\n\n');

    process.exit(0);
  });

};
