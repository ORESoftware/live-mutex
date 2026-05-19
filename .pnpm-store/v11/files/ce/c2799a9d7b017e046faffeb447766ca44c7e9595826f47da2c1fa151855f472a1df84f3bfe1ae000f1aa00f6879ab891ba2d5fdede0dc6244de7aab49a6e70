'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const assert = require("assert");
const _suman = global.__suman = (global.__suman || {});
const base_1 = require("../base");
const suman_constants_1 = require("../../config/suman-constants");
const general_1 = require("../../helpers/general");
class TestCaseParam extends base_1.ParamBase {
    constructor(test, assertCount, handleError, fini, timerObj) {
        super();
        this.__assertCount = assertCount;
        this.__planCalled = false;
        this.value = test.value;
        this.testId = test.testId;
        this.desc = this.title = test.desc;
        this.data = test.data;
        this.__test = test;
        this.__handle = handleError;
        this.__fini = fini;
        const v = this.__timerObj = timerObj;
        const amount = _suman.weAreDebugging ? 5000000 : test.timeout;
        v.timer = setTimeout(this.onTimeout.bind(this), amount);
    }
    skip() {
        this.__test.skipped = true;
        this.__test.dynamicallySkipped = true;
    }
    onTimeout() {
        const v = this.__test;
        v.timedOut = true;
        const err = general_1.cloneError(v.warningErr, suman_constants_1.constants.warnings.TEST_CASE_TIMED_OUT_ERROR);
        err.isFromTest = true;
        err.isTimeout = true;
        this.__handle(err);
    }
    __inheritedSupply(target, prop, value, receiver) {
        this.__handle(new Error('cannot set any properties on t.supply (in test cases).'));
        return true;
    }
    plan(num) {
        const test = this.__test;
        if (this.__planCalled) {
            _suman.writeTestError(new Error('Suman warning => t.plan() called more than once for ' +
                'the same test case.').stack);
            return;
        }
        this.__planCalled = true;
        if (test.planCountExpected !== undefined) {
            _suman.writeTestError(new Error('Suman warning => t.plan() called, even though plan ' +
                'was already passed as an option.').stack);
        }
        assert(Number.isInteger(num), 'Suman usage error => value passed to t.plan() is not an integer.');
        test.planCountExpected = this.planCountExpected = num;
    }
    confirm() {
        this.__assertCount.num++;
    }
}
exports.TestCaseParam = TestCaseParam;
