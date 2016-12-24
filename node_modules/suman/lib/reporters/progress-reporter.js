//core
const util = require('util');

//npm
const ProgressBar = require('progress');
const events = require('suman-events');


////////////////////////////////////////

function onAnyEvent (data) {
    process.stdout.write(data);
}

module.exports = s => {

  var progressBar;

  s.on(events.RUNNER_STARTED, function onRunnerStart (totalNumTests) {

    console.log('\n');

    progressBar = new ProgressBar(' => progress [:bar] :percent :current :token1 :token2', {
        total: totalNumTests,
        width: 120
      }
    );
  });

  s.on(events.TEST_FILE_CHILD_PROCESS_EXITED, function onTestEnd (d) {
    // process.stdout.write('\n\n');
    // process.stdout.write(' Test finished with exit code = ' + d.exitCode + ' => path => ' + d.testPath);
    // process.stdout.write('\n\n');
    progressBar.tick({
      'token1': "",
      'token2': ""
    });
  });

  s.on(events.RUNNER_EXIT_CODE, onAnyEvent);

  s.on(events.RUNNER_ENDED, function onRunnerEnd () {
       console.log('\n => Runner end event fired.');
  });

  s.on('suite-skipped', function onRunnerEnd () {

  });

  s.on('suite-end', function onRunnerEnd () {

  });

};
