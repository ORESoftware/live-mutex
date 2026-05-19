'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const EE = require("events");
const suman_events_1 = require("suman-events");
const _suman = global.__suman = (global.__suman || {});
const resultBroadcaster = _suman.resultBroadcaster = (_suman.resultBroadcaster || new EE());
exports.logTestResult = function (data, n) {
    const test = data.test;
    resultBroadcaster.emit(String(suman_events_1.events.TEST_CASE_END), test);
    if (test.errorDisplay) {
        resultBroadcaster.emit(String(suman_events_1.events.TEST_CASE_FAIL), test);
    }
    else {
        if (test.skipped) {
            resultBroadcaster.emit(String(suman_events_1.events.TEST_CASE_SKIPPED), test);
        }
        else if (test.stubbed) {
            resultBroadcaster.emit(String(suman_events_1.events.TEST_CASE_STUBBED), test);
        }
        else {
            resultBroadcaster.emit(String(suman_events_1.events.TEST_CASE_PASS), test);
        }
    }
};
