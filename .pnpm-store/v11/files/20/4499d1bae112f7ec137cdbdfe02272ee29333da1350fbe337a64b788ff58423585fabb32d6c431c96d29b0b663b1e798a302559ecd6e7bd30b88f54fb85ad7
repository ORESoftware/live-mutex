'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const assert = require("assert");
const EE = require("events");
const util = require("util");
const su = require("suman-utils");
const chai = require("chai");
const _suman = global.__suman = (global.__suman || {});
let badProps = {
    inspect: true,
    constructor: true
};
const slice = Array.prototype.slice;
const notCallbackOrientedError = 'You have fired a callback for a test case or hook that was not callback oriented.';
class ParamBase extends EE {
    constructor() {
        super();
    }
    timeout(val) {
        this.__timerObj.timer && clearTimeout(this.__timerObj.timer);
        try {
            assert(val && Number.isInteger(val), 'value passed to timeout() must be an integer.');
        }
        catch (e) {
            return this.__handle(e);
        }
        const amount = _suman.weAreDebugging ? 5000000 : val;
        this.__timerObj.timer = setTimeout(this.onTimeout.bind(this), amount);
    }
    done(err) {
        if (this && this.__handle) {
            this.__handle(new Error(notCallbackOrientedError));
        }
        else {
            throw new Error(notCallbackOrientedError);
        }
    }
    fatal(err) {
        if (!err) {
            err = new Error('t.fatal() was called by the developer, with a falsy first argument.');
        }
        else if (!su.isObject(err)) {
            let msg = 't.fatal() was called by the developer: ';
            err = new Error(msg + util.inspect(err));
        }
        err.sumanFatal = true;
        this.__handle(err);
    }
    set(k, v) {
        if (arguments.length < 2) {
            throw new Error('Must pass both a key and value to "set" method.');
        }
        return this.__shared.set(k, v);
    }
    get(k) {
        if (arguments.length < 1) {
            return this.__shared.getAll();
        }
        return this.__shared.get(k);
    }
    getValues(...args) {
        const self = this;
        return args.map(function (k) {
            return self.__shared.get(k);
        });
    }
    getMap(...args) {
        const self = this;
        const ret = {};
        args.forEach(function (a) {
            ret[a] = self.__shared.get(a);
        });
        return ret;
    }
    wrap(fn) {
        const self = this;
        return function () {
            try {
                return fn.apply(this, arguments);
            }
            catch (e) {
                return self.__handle(e, false);
            }
        };
    }
    ;
    wrapFinal(fn) {
        const self = this;
        return function () {
            try {
                fn.apply(this, arguments);
            }
            catch (e) {
                return self.__handle(e, false);
            }
            self.__fini(null);
        };
    }
    final(fn, ctx) {
        try {
            fn.call(ctx || null);
        }
        catch (e) {
            return this.__handle(e, false);
        }
        this.__fini(null);
    }
    finally(fn, ctx) {
        return this.final.apply(this, arguments);
    }
    log(...args) {
        console.log(` [ '${this.desc || 'unknown'}' ] `, ...args);
    }
    slow() {
        this.timeout(30000);
    }
    wrapFinalErrorFirst(fn) {
        const self = this;
        return function (err) {
            if (err) {
                return self.__handle(err, false);
            }
            try {
                fn.apply(this, slice.call(arguments, 1));
            }
            catch (e) {
                return self.__handle(e, false);
            }
            self.__fini(null);
        };
    }
    wrapErrorFirst(fn) {
        const self = this;
        return function (err) {
            if (err) {
                return self.__handle(err, false);
            }
            try {
                return fn.apply(this, slice.call(arguments, 1));
            }
            catch (e) {
                return self.__handle(e, false);
            }
        };
    }
    handleAssertions(fn, ctx) {
        try {
            return fn.call(ctx || null);
        }
        catch (e) {
            return this.__handle(e);
        }
    }
    handlePossibleError(err) {
        err ? this.__handle(err) : this.__fini(null);
    }
    handleNonCallbackMode(err) {
        err = err ? ('Also, you have this error => ' + err.stack || err) : '';
        this.__handle(new Error('Callback mode for this test-case/hook is not enabled, use .cb to enabled it.\n' + err));
    }
    throw(str) {
        this.__handle(str instanceof Error ? str : new Error(str));
    }
}
exports.ParamBase = ParamBase;
Object.setPrototypeOf(ParamBase.prototype, Function.prototype);
const proto = Object.assign(ParamBase.prototype, EE.prototype);
proto.pass = proto.ctn = proto.fail = proto.done;
proto.wrapFinalErrFirst = proto.wrapFinalErr = proto.wrapFinalError = proto.wrapFinalErrorFirst;
proto.wrapErrFirst = proto.wrapErrorFirst;
const assertCtx = {
    val: null
};
const expectCtx = {
    val: null
};
const expct = function () {
    const ctx = expectCtx.val;
    if (!ctx) {
        throw new Error('Suman implementation error => expect context is not defined.');
    }
    try {
        return chai.expect.apply(chai.expect, arguments);
    }
    catch (e) {
        return ctx.__handle(e);
    }
};
const expectProxy = new Proxy(expct, {
    get: function (target, prop) {
        if (typeof prop === 'symbol') {
            return Reflect.get.apply(Reflect, arguments);
        }
        const ctx = expectCtx.val;
        if (!ctx) {
            throw new Error('Suman implementation error => assert context is not defined.');
        }
        if (!(prop in chai.expect)) {
            try {
                return Reflect.get.apply(Reflect, arguments);
            }
            catch (err) {
                return ctx.__handle(new Error(`The assertion library used does not have a '${prop}' property or method.`));
            }
        }
        return function () {
            try {
                return chai.expect[prop].apply(chai.expect, arguments);
            }
            catch (e) {
                return ctx.__handle(e);
            }
        };
    }
});
Object.defineProperty(proto, 'expect', {
    get: function () {
        expectCtx.val = this;
        return expectProxy;
    }
});
const assrt = function () {
    const ctx = assertCtx.val;
    if (!ctx) {
        throw new Error('Suman implementation error => assert context is not defined.');
    }
    try {
        return chai.assert.apply(chai.assert, arguments);
    }
    catch (e) {
        return ctx.__handle(e);
    }
};
const assertProxy = new Proxy(assrt, {
    get: function (target, prop) {
        if (typeof prop === 'symbol') {
            return Reflect.get.apply(Reflect, arguments);
        }
        const ctx = assertCtx.val;
        if (!ctx) {
            throw new Error('Suman implementation error => assert context is not defined.');
        }
        if (!(prop in chai.assert)) {
            try {
                return Reflect.get.apply(Reflect, arguments);
            }
            catch (err) {
                return ctx.__handle(new Error(`The assertion library used does not have a '${prop}' property or method.`));
            }
        }
        return function () {
            try {
                return chai.assert[prop].apply(chai.assert, arguments);
            }
            catch (e) {
                return ctx.__handle(e);
            }
        };
    }
});
Object.defineProperty(proto, 'assert', {
    get: function () {
        assertCtx.val = this;
        return assertProxy;
    }
});
