'use striiiict';

//core
const path = require('path');
const util = require('util');
const assert = require('assert');

//npm
const colors = require('colors/safe');

//project
const events = require('suman-events');

////////////////////////////////////////////////////

var loaded = false;

module.exports = function loadReporters (opts, projectRoot, sumanConfig, resultBroadcaster) {

  if(loaded){
    console.log(' => Suman implementation cross-check => reporters already loaded.');
    return;
  }
  else{
    loaded = true;
  }


  const sumanReporters = global.sumanReporters = (opts.reporter_paths || []).map(function (item) {
    if (!path.isAbsolute(item)) {
      item = path.resolve(projectRoot + '/' + item);
    }
    const fn = require(item);
    assert(typeof fn === 'function', ' (Supposed) reporter module does not export a function, at path = "' + item + '"');
    fn.pathToReporter = item;
    return fn;
  });

  if (opts.reporters && typeof sumanConfig.reporters !== 'object') {
    throw new Error(' => Suman fatal error => You provided reporter names but have no reporters object in your suman.conf.js file.');
  }

  const reporterKV = sumanConfig.reporters || {};

  (opts.reporters || []).forEach(function (item) {

    //TODO: check to see if paths of reporter paths clashes with paths from reporter names at command line (unlikely)

    var fn;

    if(!(item in reporterKV)){

      try{
        fn = require(item);
        assert(typeof fn === 'function', ' (Supposed) reporter module does not export a function, at path = "' + val + '"');
      }
      catch(err){
        throw new Error(colors.red(' => Suman fatal exception => Could not load reporter with name => "' + item + '"')
          + '\n => ' + (err.stack || err) + '\n');
      }

    }
    else{
      var val = reporterKV[ item ];
      if (!val) {
        throw new Error(' => Suman fatal error => no reporter with name = "' + item + '" in your suman.conf.js file.');
      }
      else {

        if (typeof val === 'string') {
          if (!path.isAbsolute(val)) {
            val = path.resolve(projectRoot + '/' + val);
          }
          fn = require(val);
        }
        else {
          fn = val;
        }
      }
    }

    assert(typeof fn === 'function', ' (Supposed) reporter module does not export a function, at path = "' + val + '"');
    fn.pathToReporter = val;
    sumanReporters.push(fn);

  });

  if (sumanReporters.length < 1) {
    console.log(' => Using native/std reporter','\n');
    resultBroadcaster.emit(events.USING_STANDARD_REPORTER);
    const fn = require('../reporters/std-reporter');
    assert(typeof fn === 'function', 'Suman native reporter fail.');
    sumanReporters.push(fn);
  }

  sumanReporters.forEach(function (reporter) {
    reporter.apply(null, [ resultBroadcaster ]);
  });

};
