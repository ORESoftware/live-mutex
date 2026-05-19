'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const chalk_1 = require("chalk");
const su = require("suman-utils");
const loggers = {};
const calledReporters = {};
exports.getLogger = function (reporterName) {
    if (loggers[reporterName]) {
        return loggers[reporterName];
    }
    reporterName = reporterName || `browser-reporting`;
    let stdReporterName = ` [suman '${reporterName}'] `;
    return loggers[reporterName] = {
        info: console.log.bind(console, chalk_1.default.gray.bold(stdReporterName)),
        warning: console.error.bind(console, chalk_1.default.yellow(stdReporterName)),
        error: console.error.bind(console, chalk_1.default.red(stdReporterName)),
        good: console.error.bind(console, chalk_1.default.cyan(stdReporterName)),
        veryGood: console.log.bind(console, chalk_1.default.green(stdReporterName))
    };
};
exports.wrapReporter = function (reporterName, fn) {
    if (calledReporters[reporterName]) {
        console.error(new Error(`"${exports.wrapReporter.name}" called more than once for reporter with name ${reporterName}`).stack);
    }
    calledReporters[reporterName] = true;
    const log = exports.getLogger(reporterName);
    if (su.vgt(5)) {
        log.info(`file was loaded for reporter with name '${reporterName}'.`);
    }
    const retContainer = {
        ret: null
    };
    return function (s, sumanOpts, expectations, client) {
        if (retContainer.ret) {
            log.warning(`implementation warning => "${reporterName}" loaded more than once.`);
            return retContainer.ret;
        }
        const results = {
            n: 0,
            passes: 0,
            failures: 0,
            skipped: 0,
            stubbed: 0
        };
        if (su.vgt(5)) {
            log.info(`loading ${reporterName}.`);
        }
        if (!sumanOpts) {
            sumanOpts = {};
            log.error('Suman implementation warning, no sumanOpts passed to reporter.');
        }
        return fn.apply(null, [retContainer, results, s, sumanOpts, expectations, client]);
    };
};
