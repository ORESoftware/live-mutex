'use strict';

//core
const EE = require('events');
const util = require('util');
const assert = require('assert');
const domain = require('domain');

//npm
const async = require('async');
const _ = require('lodash');

//project
const constants = require('../config/suman-constants');
const acquireDeps = require('./acquire-deps');
const sumanUtils = require('suman-utils/utils');

//////////////////////////////////

function run (files) {


  async.eachLimit(files, 1, function (f, cb) {

      const fullPath = f[ 0 ];
      const shortenedPath = f[ 1 ];

      debugger;

      console.log('\n', ' => Suman is now running testsuites for test filename => "' + shortenedPath + '"','\n');

      var callable = true;
      const first = function () {
        if (callable) {
          callable = false;
          cb.apply(null, arguments);
        }
        else {
          console.error(' => Suman warning => SUMAN_SINGLE_PROCESS callback fired more than once, ' +
            'here is the data passed to callback => ', util.inspect(arguments));
        }
      };

      const exportEvents = require(fullPath);
      const counts = exportEvents.counts;
      var currentCount = 0;

      // console.log('exportEvents => ',util.inspect(exportEvents));

      exportEvents
        .on('suman-test-file-complete', function () {
          currentCount++;
          console.log('current count: ',currentCount);
          console.log('sumanCount count: ',counts.sumanCount);
          if (currentCount === counts.sumanCount) {
            process.nextTick(function(){
              exportEvents.removeAllListeners();
              first(null);
            });
          }
          else if (currentCount > counts.sumanCount) {
            throw new Error(' => Count should never be greater than expected count.');
          }

        })
        .on('test', function (test) {
          test.apply(null);
        })
        .once('error', function (e) {
          console.log(e.stack || e);
          first(e);
        });

    },
    function (err, results) {

      // TODO: SUMAN ONCE POST!!

      if (err) {
        console.error(err.stack || err);
        process.exit(1);
      }
      else {
        console.log('\n\n => Suman message => SUMAN_SINGLE_PROCESS run is now complete =>\n\n' +
          ' => Time required for all tests in single process => ', Date.now() - global.sumanSingleProcessStartTime);

        process.exit(0);
      }

    });

}

module.exports = run;

