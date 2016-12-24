'use striiiict';

//npm
const events = require('suman-events');


//project
function title(test) {
    return String(test.title).replace(/#/g, '');
}


module.exports = s => {

    var n = 1;
    var passes = 0;
    var failures = 0;

    s.on(events.RUNNER_STARTED, function onRunnerStart() {

    });


    s.on(events.RUNNER_ENDED, function onRunnerEnd() {
        console.log('# tests ' + (passes + failures));
        console.log('# pass ' + passes);
        console.log('# fail ' + failures);
    });

    s.on('suite-skipped', function onRunnerEnd() {
        console.log('# tests ' + (passes + failures));
        console.log('# pass ' + passes);
        console.log('# fail ' + failures);
    });

    s.on('suite-end', function onRunnerEnd() {
        console.log('# tests ' + (passes + failures));
        console.log('# pass ' + passes);
        console.log('# fail ' + failures);
    });

    s.on('test-end', function onTestEnd() {
        ++n;
    });

    s.on(events.TEST_CASE_FAIL, function onTestCaseFail(value, data) {
        console.log('not ok %d %s', n, title(test));
    });

    s.on(events.TEST_CASE_PASS, function onTestCasePass(value, data) {
        console.log('ok %d %s', n, title(test));
    });

    s.on(events.TEST_CASE_SKIPPED, function onTestCaseStubbed(value, data) {
        console.log('ok %d %s # SKIP -', n, title(test));
    });

    s.on(events.TEST_CASE_STUBBED, function onTestCaseStubbed(value, data) {
        console.log('ok %d %s # STUBBED -', n, title(test));
    });


};
