'use striiiict';

//core
const assert = require('assert');
const util = require('util');

//npm
const inquirer = require('suman-inquirer');
const colors = require('colors/safe');

//project
const debug = require('debug')('suman:interactive');
const chooseDirs = require('../../helpers/choose-dirs');
const sumanUtils = require('suman-utils/utils');
const rejectionHandler = require('../../interactive-rejection-handler');
const choices = require('../../helpers/choices');
const nodeOrSuman = require('../../helpers/node-or-suman');
const getOptions = require('../../helpers/available-options');
const filteredOptions = require('../../helpers/return-filtered-opts');
const localOrGlobal = require('../../helpers/local-or-global-suman');
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

const availableOptionsForPlainNode = filteredOptions(opts);
const availableOptionsForSuman = filteredOptions(opts);

////////////////////////////////////////////////////////////

const completeFns = [];
const fns = [
  nodeOrSuman,
  localOrGlobal,
  chooseDirs,
  getOptions
];

///////////////////////////////////////////////////////////

function run (opts, cb) {

  opts.onlyOneFile = true;
  opts.optionsToUse = (opts.exec === 'suman') ? availableOptionsForPlainNode : availableOptionsForSuman;

  promiseReducer(run, opts, cb, fns, completeFns).then(function (obj) {

    assert(obj.pathsToRun.length > 0, ' Need to select at least one path.');
    const selectedOpts = obj[ 'command-line-options' ];
    const pathsToRun = obj.pathsToRun;
    const $exec = iu.mapSumanExec(obj.exec, obj.localOrGlobal);
    const _cb = iu.createCallback(run, obj, cb);
    iu.allDoneHere([ '$', $exec, pathsToRun, selectedOpts ], false, _cb);

  }).catch(rejectionHandler);

}

module.exports = function makePromise (opts, cb) {

  opts.msg = 'Would you like to run your test with the Node or Suman executable? \n' +
    '(The result is basically the same, but there are' +
    'some nuances, especially when it comes to debugging.)';

  return run(opts, cb);

};