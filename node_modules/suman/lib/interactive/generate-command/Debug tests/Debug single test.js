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
const debugSingle = require('../../helpers/debug-single');
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
  debugSingle,
  chooseDirs,
  getOptions
];

function run (opts, cb) {

  opts.onlyOneFile = true;
  opts.optionsToUse = (opts.exec === 'suman') ? availableOptionsForPlainNode : availableOptionsForSuman;

  promiseReducer(run, opts, cb, fns, completeFns).then(function (obj) {

    assert(obj.pathsToRun.length > 0, ' Need to select at least one path.');
    const selectedOpts = obj[ 'command-line-options' ];
    const pathsToRun = obj.pathsToRun;
    const ex = iu.mapSumanExec(obj.debugCmd, obj.localOrGlobal);
    const _cb = iu.createCallback(run, obj, cb);
    iu.allDoneHere([ '$', ex, pathsToRun, selectedOpts ], false, _cb);

  }).catch(rejectionHandler);

}

function zoom (obj, cb) {

  const _zoom = zoom.bind(null, obj, cb);

  return localOrGlobal(obj, cb).then(function (obj) {
    return run(obj, cb);
  });

}

module.exports = function makePromise (opts, cb) {

  opts.msg = 'Would you like to debug your test with the Node or Suman executable?' +
    ' (Suman makes it easy to use either).\n\n';

  return run(opts,cb);
  // const _makePromise = makePromise.bind(null, opts, cb);
  //
  // return nodeOrSuman(opts, cb).then(function (obj) {
  //   return zoom(obj, _makePromise);
  // }).catch(rejectionHandler);

};