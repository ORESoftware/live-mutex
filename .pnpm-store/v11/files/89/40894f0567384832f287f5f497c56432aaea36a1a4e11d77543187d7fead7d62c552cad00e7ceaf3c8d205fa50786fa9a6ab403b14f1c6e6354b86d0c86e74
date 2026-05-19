'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const assert = require("assert");
const chai = require('chai');
const chaiAssert = chai.assert;
const _suman = global.__suman = (global.__suman || {});
const base_1 = require("../base");
const suman_constants_1 = require("../../config/suman-constants");
const general_1 = require("../../helpers/general");
let badProps = {
    inspect: true,
    constructor: true
};
class EachHookParam extends base_1.ParamBase {
    constructor(hook, assertCount, handleError, fini, timerObj) {
        super();
        this.__planCalled = false;
        this.__hook = hook;
        this.__handle = handleError;
        this.__fini = fini;
        this.__assertCount = assertCount;
        const v = this.__timerObj = timerObj;
        const amount = _suman.weAreDebugging ? 5000000 : hook.timeout;
        const fn = this.onTimeout.bind(this);
        v.timer = setTimeout(fn, amount);
    }
    skip() {
        (this.__hook).skipped = true;
        (this.__hook).dynamicallySkipped = true;
    }
    onTimeout() {
        const v = this.__hook;
        v.timedOut = true;
        const err = general_1.cloneError(v.warningErr, suman_constants_1.constants.warnings.HOOK_TIMED_OUT_ERROR);
        err.isTimeout = true;
        this.__handle(err);
    }
    plan(num) {
        if (this.__planCalled) {
            _suman.writeTestError(new Error('Suman warning => plan() called more than once.').stack);
            return;
        }
        const hook = this.__hook;
        this.__planCalled = true;
        if (hook.planCountExpected !== undefined) {
            _suman.writeTestError(new Error(' => Suman warning => plan() called, even though plan was already passed as an option.').stack);
        }
        try {
            assert(Number.isInteger(num), 'Suman usage error => value passed to plan() is not an integer.');
        }
        catch (err) {
            return this.__handle(err);
        }
        hook.planCountExpected = this.planCountExpected = num;
    }
    confirm() {
        this.__assertCount.num++;
    }
}
exports.EachHookParam = EachHookParam;
