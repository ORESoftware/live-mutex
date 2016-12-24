'use striiiict';

//core
const assert = require('assert');
const util = require('util');
const cp = require('child_process');

//npm
const inquirer = require('suman-inquirer');
const colors = require('colors/safe');

//project
const debug = require('debug')('suman:interactive');
const chooseDirs = require('../../helpers/choose-dirs');
const sumanUtils = require('suman-utils/utils');
const rejectionHandler = require('../../interactive-rejection-handler');
const localOrGlobal = require('../../helpers/local-or-global-suman');
const choices = require('../../helpers/choices');
const getOptions = require('../../helpers/available-options');
const filteredOptions = require('../../helpers/return-filtered-opts');

/////////////////////////////////////////////////////////////

const opts = [
  'verbose',
  'sparse',
  'match-any',
  'match-none',
  'match-all'
];

const availableOptionsForPlainNode = filteredOptions(opts);

////////////////////////////////////////////////////////////

function runWithSumanRunner (rootDir) {

  return chooseDirs({

    rootDir: rootDir,
    onlyOneFile: false

  }).then(function (dirs) {

    assert(dirs.length > 0, ' You need to select at least one path.');

    return getOptions(availableOptionsForPlainNode).then(function (answers) {

      const selectedOpts = answers[ 'command-line-options' ];

      return localOrGlobal().then(function (val) {

        const sumanExec = choices.localOrGlobalChoices[ val.localOrGlobal ];
        console.log('\n\n => All done here! The valid Suman command to run is => \n');
        console.log(' => ',
          colors.magenta.bold([ '$', sumanExec, dirs, '--transpile', selectedOpts ].join(' ')));

        console.log('\n\n');

      }).catch(rejectionHandler);

    });

  });

}

module.exports = function makePromise (rootDir) {

  return inquirer.prompt([
    {

      type: 'confirm',
      name: 'confirm',
      message: colors.yellow(' => To run multiple tests you will use the Suman runner which will ' +
        'run each test in a separate process.') +
      '\n Suman will automatically use the runner when you point Suman at multiple files, or a directory.\n\n'
      + colors.blue(' First we will give you the chance to select one or more files or directories to' +
        'run the runner against.\n' +
        ' If you select only one file, then you must use the --runner option to tell Suman to use the runner, ' +
        'instead of just a single process.') + '\n\n\n' +
      ' This utility will make sure you do it right, don\'t worry.' + '\n\n' +
      colors.green(' Please confirm.') + ' (To skip this message, use the --fast option).',
      when: function () {
        console.log(' ------------------------------------------------------- ');
        return true;
      }
    },

  ]).then(function (answers) {

    if (answers.confirm) {
      return runWithSumanRunner(rootDir);
    }
    else {
      console.log(' Well, we are done here then. Please start over.');
    }

  }).catch(rejectionHandler);

};