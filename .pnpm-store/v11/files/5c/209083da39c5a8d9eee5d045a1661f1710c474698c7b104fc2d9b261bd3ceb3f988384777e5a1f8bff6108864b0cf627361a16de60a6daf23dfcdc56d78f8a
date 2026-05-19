'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const chalk = require("chalk");
const log_prepend_1 = require("log-prepend");
const _suman = global.__suman = (global.__suman || {});
if (('SUMAN_INCEPTION_LEVEL' in process.env) && process.argv.indexOf('--force-inception-level-zero') < 0) {
    let sil = parseInt(process.env.SUMAN_INCEPTION_LEVEL);
    let silVal = ++sil;
    _suman.inceptionLevel = silVal;
    process.env.SUMAN_INCEPTION_LEVEL = silVal;
}
else {
    _suman.inceptionLevel = 0;
    process.env.SUMAN_INCEPTION_LEVEL = 0;
}
_suman.log = {};
if (_suman.inceptionLevel < 1 && String(process.env.SUMAN_USE_STDIO_PREFIX).trim() !== 'no') {
    const resetterFn = function () {
        _suman.isTestMostRecentLog = false;
    };
    _suman.log.info = log_prepend_1.lp(chalk.gray.bold(' [suman] '), process.stdout, null, resetterFn);
    _suman.log.good = log_prepend_1.lp(chalk.cyan.bold(' [suman] '), process.stdout, null, resetterFn);
    _suman.log.verygood = log_prepend_1.lp(chalk.green.bold(' [suman] '), process.stdout, null, resetterFn);
    _suman.log.warning = log_prepend_1.lp(chalk.yellow(' [suman] '), process.stderr, null, resetterFn);
    _suman.log.error = log_prepend_1.lp(chalk.red(' [suman] '), process.stderr, null, resetterFn);
}
else {
    _suman.$forceInheritStdio = true;
    if (_suman.sumanOpts) {
        _suman.sumanOpts.$forceInheritStdio = true;
    }
    _suman.log.info = console.log.bind(console);
    _suman.log.warning = console.error.bind(console);
    _suman.log.error = console.error.bind(console);
    _suman.log.verygood = console.log.bind(console);
    _suman.log.good = console.log.bind(console);
}
