'use striiict';

//core
const util = require('util');

//project
const handleRequestResponseWithRunner = require('./handle-runner-request-response');
const counts = require('./suman-counts');
const oncePostFn = require('./handle-suman-once-post');
const suiteResultEmitter = global.suiteResultEmitter = (global.suiteResultEmitter || new EE());

///////////////////////////////////////////////////////////////////

const results = [];

suiteResultEmitter.on('suman-completed', function (obj) {

  counts.completedCount++;
  results.push(obj);

  if (counts.completedCount === counts.sumanCount) {

    var fn;

    var resultz;

    if (global.usingRunner) {
      resultz = results.map(i => i.tableData);
      fn = handleRequestResponseWithRunner(resultz);
    }
    else {

      // i may not be defined if testsuite (rootsuite) was skipped
      resultz = results.map(i => i ? i.tableData : null).filter(i => i);

      resultz.forEach(function (table) {
        console.log('\n\n');
        var str = table.toString();
        str = '\t' + str;
        console.log(str.replace(/\n/g, '\n\t'));
        console.log('\n');
      });

      fn = oncePostFn;
    }

    const codes = results.map(i => i.exitCode);

    if (process.env.SUMAN_DEBUG === 'yes') {
      console.log(' => All "exit" codes from test suites => ', codes);
    }

    const highestExitCode = Math.max.apply(null, codes);

    fn(function (err) {
      if (err) {
        console.error(err.stack || err);
      }

      process.exit(highestExitCode);

    });

  }
  else if (counts.completedCount > counts.sumanCount) {
    throw new Error('=> Suman internal implementation error => ' +
      'completedCount should never be greater than sumanCount.');
  }

});