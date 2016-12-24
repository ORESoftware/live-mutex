'use striiiict';


const events = require('suman-events');

function title(test) {
    return String(test.desc).replace(/#/g, '');
}

module.exports = s => {

    var n = 0;
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

    s.on('test-case-end', function onTestEnd() {
        ++n;
    });

    s.on('test-case-fail', function onTestCaseFail(value, data) {
        console.log('\tnot ok %d %s', n, title(value));
    });

    s.on('test-case-pass', function onTestCasePass(value, data) {
        console.log('\tok %d %s', n, title(value));
    });

    s.on('test-case-skipped', function onTestCaseStubbed(value, data) {
        console.log('\tok %d %s # SKIP -', n, title(value));
    });

    s.on('test-case-stubbed', function onTestCaseStubbed(value, data) {
        console.log('\tok %d %s # STUBBED -', n, title(value));
    });


};
