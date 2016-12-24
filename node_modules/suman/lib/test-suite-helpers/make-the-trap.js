
//core
const domain = require('domain');

//npm
const async = require('async');

//project
const makeHandleTestResults = require('./handle-test-result');
const makeHandleTest = require('./handle-test');
const makeAllEaches = require('./get-all-eaches');
const makeHandleBeforeOrAfterEach = require('./make-handle-each');
const implementationError = require('../helpers/implementation-error');


////////////////////////////////////////////////////

module.exports = function makeTheTrap(suman, gracefulExit) {

    const allDescribeBlocks = suman.allDescribeBlocks;
    const handleTest = makeHandleTest(suman, gracefulExit);
    const handleTestResult = makeHandleTestResults(suman);
    const allEachesHelper = makeAllEaches(suman, allDescribeBlocks);
    const handleBeforeOrAfterEach = makeHandleBeforeOrAfterEach(suman, gracefulExit);

    return function runTheTrap(self, test, opts, cb) {

        if (global.sumanUncaughtExceptionTriggered) {
            console.error(' => Suman runtime error => "UncaughtException:Triggered" => halting program.');
            return;
        }

        var delaySum = 0; //TODO: is this correct?

        //TODO: why not run only check earlier?
        if (test.skipped || test.stubbed) {
            process.nextTick(function () {
                cb(null, []);   //TODO: add skipped call
            });
            return;
        }

        const parallel = opts.parallel;

        async.mapSeries(allEachesHelper.getAllBeforesEaches(self), function (aBeforeEach, cb) {
                handleBeforeOrAfterEach(self, test, aBeforeEach, cb);
            },
            function doneWithBeforeEaches(err, results) {
                implementationError(err);

                // results.filter(i=>i).forEach(function (r) {
                //     console.log('result =>', r);
                // });


                if (parallel) {
                    delaySum += (test.delay || 0);
                } else {
                    delaySum = 0;
                }

                async.series([
                        function (cb) {

                            function handleTestContainer() {
                                handleTest(self, test, function (err, result) {
                                    implementationError(err);
                                    gracefulExit(handleTestResult(result, test), test, function () {
                                        cb(null, result);
                                    });
                                });
                            }

                            if (delaySum) { // if non-zero / non-falsy value
                                setTimeout(handleTestContainer, delaySum);
                            }
                            else {
                                handleTestContainer();
                            }

                        },

                        function (cb) {

                            async.mapSeries(allEachesHelper.getAllAfterEaches(self), function (aAfterEach, cb) {
                                handleBeforeOrAfterEach(self, test, aAfterEach, cb);
                            }, function done(err, results) {
                                implementationError(err);
                                process.nextTick(cb);
                            });

                        }
                    ],
                    function doneWithTests(err, results) {
                        cb(null, results);
                    });

            });
    }

};
