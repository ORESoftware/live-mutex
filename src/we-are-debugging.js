'use strict';
exports.__esModule = true;
//core
var util = require('util');
///////////////////////////////////////
var execArgs = process.execArgv.slice(0); //copy it
//////////////////////////////////////////////////////////
var inDebugMode = typeof global.v8debug === 'object';
var expressions = [
    '--debug',
    'debug',
    '--debug-brk',
    '--inspect',
    '--debug=5858',
    '--debug-brk=5858'
];
// at least one of these conditions is true
var isDebug = expressions.some(function (x) { return execArgs.indexOf(x) > -1; });
if (process.env.SUMAN_DEBUG === 'yes') {
    console.log('\n => Exec args => ', util.inspect(execArgs), '\n');
}
if (isDebug) {
    console.log('=> we are debugging with the --debug flag');
}
if (inDebugMode) {
    console.log('=> we are debugging with the debug execArg');
}
exports.weAreDebugging = (isDebug || inDebugMode);
