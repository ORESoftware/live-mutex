'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const cp = require("child_process");
const path = require("path");
const chalk = require("chalk");
const _suman = global.__suman = (global.__suman || {});
exports.handleTestCoverageReporting = function (cb) {
    if (!_suman.sumanOpts.coverage || _suman.sumanOpts.no_report) {
        return process.nextTick(cb);
    }
    console.log('\n');
    _suman.log.info(chalk.blue.bold('Suman is running the Istanbul collated report.'));
    _suman.log.info(chalk.blue.bold('To disable automatic report generation, use "--no-coverage-report".'));
    const coverageDir = path.resolve(_suman.projectRoot + '/coverage/suman_by_timestamp/' + _suman.timestamp);
    const args = ['report', '--dir', coverageDir, '--include', '**/*coverage.json', 'lcov'];
    const k = cp.spawn(_suman.istanbulExecPath || 'istanbul', args, {
        cwd: _suman.projectRoot
    });
    k.stderr.pipe(process.stderr);
    k.once('close', function (code) {
        k.unref();
        cb(code ? new Error(`Test coverage process exitted with non-zero exit code => "${code}".`) : null, code);
    });
};
