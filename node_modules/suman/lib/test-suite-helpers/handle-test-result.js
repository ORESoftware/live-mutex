//core
const util = require('util');

//project
const sumanUtils = require('suman-utils/utils');

/////////////////////////////////////////////////////////

const testErrors = global.testErrors = global.testErrors || [];
const errors = global.sumanRuntimeErrors = global.sumanRuntimeErrors || [];

//////////////////////////////////////////////////////////

module.exports = function makeHandleTestError(suman) {

    const fileName = suman.fileName;

    return function handleTestError(err, test) {

        if (global.sumanUncaughtExceptionTriggered) {
            console.error(' => Suman runtime error => "UncaughtException:Triggered" => halting program.');
            return;
        }

        test.error = null;

        if (err) {

            const sumanFatal = err.sumanFatal;

            if (err instanceof Error) {

                test.error = err;
                const stack = String(err.stack).split('\n');
                test.errorDisplay = stack.map(function (item, index) {

                    if (item && index === 0) {
                        return '\t' + item;
                    }
                    if (item) {
                        if (sumanFatal) {
                            return sumanUtils.padWithFourSpaces() + item;  //4 spaces
                        }
                        //TODO: if we want full-stack-traces, then implement here
                        if (String(item).includes(fileName)) {
                            return sumanUtils.padWithFourSpaces() + item; //4 spaces
                        }

                        return sumanUtils.padWithFourSpaces() + item; //4 spaces

                    }

                }).filter(item => item).join('\n').concat('\n');

            }
            else if (typeof err.stack === 'string') {

                test.error = err;
                test.errorDisplay = String(err.stack).split('\n').map(function (item, index) {

                    if (item && index === 0) {
                        return '\t' + item;
                    }
                    if (item) {
                        if (sumanFatal) {
                            return sumanUtils.padWithXSpaces(4) + item;  //4 spaces
                        }
                        //TODO: if we want full-stack-traces, then implement here
                        if (String(item).includes(fileName)) {
                            return sumanUtils.padWithXSpaces(4) + item; //4 spaces
                        }

                        return sumanUtils.padWithXSpaces(4) + item; //4 spaces

                    }
                }).filter(item => item).join('\n').concat('\n');
            }
            else {
                throw new Error('Suman internal error => invalid error format.');
            }

            if (process.env.SUMAN_DEBUG === 'yes') {
                global._writeTestError('\n\nTest error: ' + test.desc + '\n\t' + 'stack: ' + test.error.stack + '\n\n');
            }

            testErrors.push(test.error);
        }

        if (test.error) {
            test.error.isFromTest = true;
        }

        suman.logResult(test);

        return test.error;
    }
};