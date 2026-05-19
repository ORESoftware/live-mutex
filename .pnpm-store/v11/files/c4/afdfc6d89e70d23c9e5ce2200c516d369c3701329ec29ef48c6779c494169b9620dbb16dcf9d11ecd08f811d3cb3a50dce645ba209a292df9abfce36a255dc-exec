'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const { events } = require('suman-events');
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const utils_1 = require("../../lib/utils");
const reporterName = path.basename(__dirname);
const log = utils_1.getLogger(reporterName);
exports.loadReporter = utils_1.wrapReporter(reporterName, (retContainer, results, s, opts, expectations, client) => {
    const runAsync = function (fn) {
        retContainer.ret.count++;
        fn(function (err) {
            err && log.error(err.stack || err);
            retContainer.ret.count--;
            if (retContainer.ret.count < 1) {
                retContainer.ret.cb && retContainer.ret.cb();
            }
        });
    };
    s.on(events.RUNNER_STARTED, function () {
        log.info('Suman runner has started.\n');
    });
    s.on(events.RUNNER_ENDED, function () {
        console.log('# tests ' + (results.n));
        console.log('# pass ' + results.passes);
        console.log('# fail ' + results.failures);
        console.log('# stubbed ' + results.stubbed);
        console.log('# skipped ' + results.skipped);
    });
    s.on(events.TEST_CASE_END, function (test) {
        ++results.n;
    });
    s.on(events.TEST_CASE_FAIL, function (test) {
        results.failures++;
        runAsync(function (cb) {
            const str = su.customStringify({
                childId: process.env.SUMAN_CHILD_ID,
                test,
                type: 'LOG_RESULT',
            });
            client.emit('LOG_RESULT', JSON.parse(str), cb);
        });
    });
    s.on(events.TEST_CASE_PASS, function (test) {
        results.passes++;
        runAsync(function (cb) {
            const str = su.customStringify({
                childId: process.env.SUMAN_CHILD_ID,
                test,
                type: 'LOG_RESULT',
            });
            client.emit('LOG_RESULT', JSON.parse(str), cb);
        });
    });
    s.on(events.TEST_CASE_SKIPPED, function (test) {
        results.skipped++;
        runAsync(function (cb) {
            const str = su.customStringify({
                childId: process.env.SUMAN_CHILD_ID,
                test,
                type: 'LOG_RESULT',
            });
            client.emit('LOG_RESULT', JSON.parse(str), cb);
        });
    });
    s.on(events.TEST_CASE_STUBBED, function (test) {
        results.stubbed++;
        runAsync(function (cb) {
            const str = su.customStringify({
                childId: process.env.SUMAN_CHILD_ID,
                test,
                type: 'LOG_RESULT',
            });
            client.emit('LOG_RESULT', JSON.parse(str), cb);
        });
    });
    return retContainer.ret = {
        results,
        reporterName,
        count: 0,
        cb: null
    };
});
exports.default = exports.loadReporter;
