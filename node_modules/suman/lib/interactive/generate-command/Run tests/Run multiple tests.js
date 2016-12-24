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
const startGenerateCommand = require('../../helpers/start-generate-command');
const iu = require('../../helpers/interactive-utils');
const promiseReducer = require('../../helpers/promise-reducer');

/////////////////////////////////////////////////////////////

const opts = [
  'verbose',
  'sparse',
  'match-any',
  'match-none',
  'match-all'
];

const availableOptionsSumanRunner = filteredOptions(opts);

_interactiveDebug('multiple tests (Suman runner) available opts => ', util.inspect(availableOptionsSumanRunner));

////////////////////////////////////////////////////////////

const completeFns = [];
const fns = [
  startGenerateCommand,
  chooseDirs,
  getOptions,
  localOrGlobal
];

function run (opts, cb) {

  promiseReducer(run, opts, cb, fns, completeFns).then(function (obj) {

    assert(obj.pathsToRun.length > 0, ' You need to select at least one path.');
    const sumanExec = iu.mapSumanExec(obj.exec, obj.localOrGlobal);
    const pathsToRun = iu.mapDirs(obj.pathsToRun);
    const selectedOpts = obj[ 'command-line-options' ];

    const _cb = iu.createCallback(run, obj, cb);
    iu.allDoneHere([ '$', sumanExec, pathsToRun, selectedOpts ], false, _cb);

  }).catch(rejectionHandler);

}

module.exports = function makePromise (opts, backspaceCB) {

  opts.exec = 'suman';
  opts.onlyOneFile = false;
  opts.optionsToUse = availableOptionsSumanRunner;

  opts.msg = colors.yellow(' => To run multiple tests you will use the Suman runner which will ' +
      'run each test in a separate process.') +
    '\n Suman will automatically use the runner when you point Suman at multiple files, or a directory.\n\n'
    + colors.blue(' First we will give you the chance to select one or more files or directories to' +
      'run the runner against.\n' +
      ' If you select only one file, then you must use the --runner option to tell Suman to use the runner, ' +
      'instead of just a single process.') + '\n\n\n' +
    ' This utility will make sure you do it right, don\'t worry.' + '\n\n' +
    colors.green(' Please confirm.') + ' (To skip this message, use the --fast option).';

   return run(opts, backspaceCB);

};