'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const path = require("path");
const suman_events_1 = require("suman-events");
const su = require("suman-utils");
const JSONStdio = require("json-stdio");
const _suman = global.__suman = (global.__suman || {});
const utils_1 = require("../../lib/utils");
const reporterName = path.basename(__dirname);
const log = utils_1.getLogger(reporterName);
function title(test) {
    return String(test.title || test.desc || test.description || test.name).replace(/#/g, '').trim();
}
const logDebug = function () {
    let debug;
    if (debug = process.env.SUMAN_DEBUG) {
        const args = Array.from(arguments).filter(i => i);
        args.forEach(function (a) {
            process.stderr.write('\n' + (typeof a === 'string' ? a : util.inspect(a)) + '\n');
        });
    }
    return debug;
};
let onAnyEvent = function () {
    if (!logDebug.apply(null, arguments)) {
        const args = Array.from(arguments).map(function (data) {
            return typeof data === 'string' ? data : util.inspect(data);
        });
        return console.log.apply(console, args);
    }
};
let getTestFilePath = function (test) {
    return String(test.testPath || test.filePath || test.filepath || test.testpath).trim();
};
let getTestDesc = function (test) {
    return String(test.desc || test.title || test.name).trim();
};
let isTTY = process.stdout.isTTY;
exports.loadReporter = utils_1.wrapReporter(reporterName, (retContainer, results, s, sumanOpts) => {
    if (_suman.inceptionLevel < 1 && !isTTY) {
        log.warning(`"${reporterName}" warning: suman inception level is 0, we may not need to load this reporter.`);
    }
    let isColorable = function () {
        return _suman.inceptionLevel < 1 && !sumanOpts.no_color;
    };
    let getPaddingCount = function () {
        return _suman.currentPaddingCount ? _suman.currentPaddingCount.val || 0 : 0;
    };
    let getTAPJSONType = function (eventName) {
        return String(eventName) + '_TAP_JSON';
    };
    s.on(String(suman_events_1.events.TEST_CASE_END_TAP_JSON), function (d) {
        results.n++;
        JSONStdio.logToStdout(d);
    });
    s.on(String(suman_events_1.events.TEST_CASE_FAIL_TAP_JSON), function (d) {
        results.failures++;
        JSONStdio.logToStdout(d);
    });
    s.on(String(suman_events_1.events.TEST_CASE_PASS_TAP_JSON), function (d) {
        results.passes++;
        JSONStdio.logToStdout(d);
    });
    s.on(String(suman_events_1.events.TEST_CASE_SKIPPED_TAP_JSON), function (d) {
        results.skipped++;
        JSONStdio.logToStdout(d);
    });
    s.on(String(suman_events_1.events.TEST_CASE_STUBBED_TAP_JSON), function (d) {
        results.stubbed++;
        JSONStdio.logToStdout(d);
    });
    {
        let evn = String(suman_events_1.events.SUMAN_CONTEXT_BLOCK);
        s.on(evn, function (b) {
            JSONStdio.logToStdout({
                messageType: getTAPJSONType(evn),
                padding: getPaddingCount(),
                message: ` ▶ group: '${b.desc}' ▶ `
            });
        });
    }
    {
        let evn = String(suman_events_1.events.TEST_CASE_END);
        s.on(evn, function (b) {
            results.n++;
            JSONStdio.logToStdout({
                messageType: getTAPJSONType(evn),
            });
        });
    }
    {
        let evn = String(suman_events_1.events.TEST_CASE_FAIL);
        s.on(evn, function (test) {
            results.failures++;
            console.log(su.customStringify({
                '@tap-json': true,
                '@json-stdio': true,
                messageType: getTAPJSONType(evn),
                padding: getPaddingCount(),
                testCase: {
                    ok: false,
                    desc: getTestDesc(test),
                    filePath: getTestFilePath(test),
                    error: test.errorDisplay || test.error,
                    id: results.n,
                    dateComplete: test.dateComplete,
                    dateStarted: test.dateStarted
                }
            }));
        });
    }
    {
        let evn = String(suman_events_1.events.TEST_CASE_PASS);
        s.on(evn, function (test) {
            results.passes++;
            console.log(su.customStringify({
                '@tap-json': true,
                '@json-stdio': true,
                messageType: getTAPJSONType(evn),
                padding: getPaddingCount(),
                testCase: {
                    ok: true,
                    desc: getTestDesc(test),
                    filePath: getTestFilePath(test),
                    id: results.n,
                    dateComplete: test.dateComplete,
                    dateStarted: test.dateStarted
                }
            }));
        });
    }
    {
        let evn = String(suman_events_1.events.TEST_CASE_SKIPPED);
        s.on(evn, function (test) {
            results.skipped++;
            console.log(su.customStringify({
                '@tap-json': true,
                '@json-stdio': true,
                messageType: getTAPJSONType(evn),
                padding: getPaddingCount(),
                testCase: {
                    ok: true,
                    desc: getTestDesc(test),
                    filePath: getTestFilePath(test),
                    id: results.n,
                    skipped: true,
                    skip: true,
                    dateComplete: test.dateComplete,
                    dateStarted: test.dateStarted
                }
            }));
        });
    }
    {
        let evn = String(suman_events_1.events.TEST_CASE_STUBBED);
        s.on(evn, function (test) {
            results.stubbed++;
            console.log(su.customStringify({
                '@tap-json': true,
                '@json-stdio': true,
                padding: getPaddingCount(),
                messageType: getTAPJSONType(evn),
                testCase: {
                    ok: true,
                    desc: getTestDesc(test),
                    filePath: getTestFilePath(test),
                    id: results.n,
                    stubbed: true,
                    todo: true,
                    dateComplete: test.dateComplete,
                    dateStarted: test.dateStarted
                }
            }));
        });
    }
    return retContainer.ret = {
        reporterName,
        results
    };
});
exports.default = exports.loadReporter;
