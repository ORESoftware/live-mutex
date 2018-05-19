'use strict';
const util = require('util');
const execArgs = process.execArgv.slice(0);
const inDebugMode = typeof global.v8debug === 'object';
const expressions = [
    '--debug',
    'debug',
    '--debug-brk',
    '--inspect',
    '--debug=5858',
    '--debug-brk=5858'
];
const isDebug = expressions.some(x => execArgs.indexOf(x) > -1);
if (process.env.SUMAN_DEBUG === 'yes') {
    console.log('\n => Exec args => ', util.inspect(execArgs), '\n');
}
if (isDebug) {
    console.log('=> we are debugging with the --debug flag');
}
if (inDebugMode) {
    console.log('=> we are debugging with the debug execArg');
}
module.exports = global.weAreDebugging = (isDebug || inDebugMode);
