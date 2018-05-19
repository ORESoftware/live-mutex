'use strict';

//core
const util = require('util');

///////////////////////////////////////

const execArgs = process.execArgv.slice(0);  //copy it

//////////////////////////////////////////////////////////

const inDebugMode = typeof global.v8debug === 'object';

const expressions = [
    '--debug',
    'debug',
    '--debug-brk',
    '--inspect',
    '--debug=5858',
    '--debug-brk=5858'
];

// at least one of these conditions is true
const isDebug = expressions.some(x => execArgs.indexOf(x) > -1);

if (process.env.SUMAN_DEBUG === 'yes') {
    console.log('=> Exec args => ', util.inspect(execArgs), '\n');
}

if (isDebug) {
    console.log('=> we are debugging with the --debug flag');
}

if (inDebugMode) {
    console.log('=> we are debugging with the debug execArg');
}

export const weAreDebugging = (isDebug || inDebugMode);