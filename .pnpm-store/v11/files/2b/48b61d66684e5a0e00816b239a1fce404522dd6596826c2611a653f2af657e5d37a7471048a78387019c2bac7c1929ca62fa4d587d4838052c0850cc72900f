'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const assert = require("assert");
const async = require("async");
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const base_1 = require("../base");
const suman_constants_1 = require("../../config/suman-constants");
const general_1 = require("../../helpers/general");
let badProps = {
    inspect: true,
    constructor: true
};
class InjectParam extends base_1.ParamBase {
    constructor(inject, assertCount, timerObj, suite, values, fini, handleError) {
        super();
        this.__planCalled = false;
        this.__valuesMap = {};
        this.__suite = suite;
        this.__hook = inject;
        this.__handle = handleError;
        this.__fini = fini;
        this.__values = values;
        this.__assertCount = assertCount;
        this.__inject = inject;
        this.planCountExpected = null;
        const v = this.__timerObj = timerObj;
        const amount = _suman.weAreDebugging ? 5000000 : inject.timeout;
        const fn = this.onTimeout.bind(this);
        v.timer = setTimeout(fn, amount);
    }
    skip() {
        this.__hook.skipped = true;
        this.__hook.dynamicallySkipped = true;
    }
    onTimeout() {
        const v = this.__hook;
        v.timedOut = true;
        const err = general_1.cloneError(v.warningErr, suman_constants_1.constants.warnings.HOOK_TIMED_OUT_ERROR);
        err.isTimeout = true;
        this.__handle(err);
    }
    registerKey(k, val) {
        const suite = this.__suite;
        const valuesMap = this.__valuesMap;
        const values = this.__values;
        try {
            assert(k && typeof k === 'string', 'key must be a string.');
        }
        catch (err) {
            return this.__handle(err);
        }
        if (k in valuesMap) {
            return this.__handle(new Error(`Injection key '${k}' has already been added.`));
        }
        if (k in suite.injectedValues) {
            return this.__handle(new Error(`Injection key '${k}' has already been added.`));
        }
        valuesMap[k] = true;
        values.push({ k, val });
        return Promise.resolve(val);
    }
    registerFnMap(o) {
        const suite = this.__suite;
        const valuesMap = this.__valuesMap;
        const values = this.__values;
        const self = this;
        return new Promise(function (resolve, reject) {
            assert(su.isObject(o), 'value must be a non-array object.');
            async.series(o, function (err, results) {
                if (err) {
                    return reject(err);
                }
                try {
                    Object.keys(results).forEach(function (k) {
                        if (k in valuesMap) {
                            throw new Error(`Injection key '${k}' has already been added.`);
                        }
                        if (k in suite.injectedValues) {
                            throw new Error(`Injection key '${k}' has already been added.`);
                        }
                        valuesMap[k] = true;
                        values.push({ k, val: results[k] });
                    });
                }
                catch (err) {
                    return reject(err);
                }
                resolve(results);
            });
        })
            .catch(function (err) {
            return self.__handle(err);
        });
    }
    registerMap(o) {
        const suite = this.__suite;
        const valuesMap = this.__valuesMap;
        const values = this.__values;
        const keys = Object.keys(o);
        const self = this;
        let registry;
        try {
            registry = keys.map(function (k) {
                if (k in valuesMap) {
                    throw new Error(`Injection key '${k}' has already been added.`);
                }
                if (k in suite.injectedValues) {
                    throw new Error(`Injection key '${k}' has already been added.`);
                }
                valuesMap[k] = true;
                values.push({ k, val: o[k] });
                return o[k];
            });
        }
        catch (err) {
            return self.__handle(err);
        }
        return Promise.all(registry)
            .catch(function (err) {
            return self.__handle(err);
        });
    }
    plan(num) {
        if (this.__planCalled) {
            _suman.writeTestError(new Error('Suman warning => plan() called more than once.').stack);
            return;
        }
        this.__planCalled = true;
        if (this.__inject.planCountExpected !== undefined) {
            _suman.writeTestError(new Error('Suman warning => plan() called, even though plan was already passed as an option.').stack);
        }
        try {
            assert(Number.isInteger(num), 'Suman usage error => value passed to plan() is not an integer.');
        }
        catch (err) {
            return this.__handle(err);
        }
        this.__inject.planCountExpected = this.planCountExpected = num;
    }
    confirm() {
        this.__assertCount.num++;
    }
}
exports.InjectParam = InjectParam;
const p = InjectParam.prototype;
p.register = p.registerKey;
p.registerPromisesMap = p.registerPromiseMap = p.registerMap;
p.registerFnsMap = p.registerFnMap;
