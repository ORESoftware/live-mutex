'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const assert = require("assert");
const path = require("path");
const _suman = global.__suman = (global.__suman || {});
const suman_events_1 = require("suman-events");
const isEqual = require("lodash.isequal");
const utils_1 = require("../../lib/utils");
const reporterName = path.basename(__dirname);
const log = utils_1.getLogger(reporterName);
const noColors = process.argv.indexOf('--no-color') > 0;
exports.loadreporter = utils_1.wrapReporter(reporterName, (retContainer, results, s, sumanOpts, expectations) => {
    s.on(String(suman_events_1.events.TEST_CASE_PASS), function (test) {
        results.passes++;
    });
    s.on(String(suman_events_1.events.TEST_CASE_FAIL), function (test) {
        results.failures++;
    });
    s.on(String(suman_events_1.events.TEST_CASE_SKIPPED), function (test) {
        results.skipped++;
    });
    s.on(String(suman_events_1.events.TEST_CASE_STUBBED), function (test) {
        results.stubbed++;
    });
    s.on(String(suman_events_1.events.META_TEST_ENDED), function (test) {
        log.info('Suman "META_TEST_ENDED" event ', test);
        try {
            assert(isEqual(results, expectations), 'expectations and results are not equal.');
            log.veryGood('Suman "meta-test-reporter" has passed its primary test. Good news.');
        }
        catch (err) {
            console.error(err.stack || err);
            process.exit(1);
        }
    });
    return retContainer.ret = {
        results,
        reporterName
    };
});
exports.default = exports.loadreporter;
