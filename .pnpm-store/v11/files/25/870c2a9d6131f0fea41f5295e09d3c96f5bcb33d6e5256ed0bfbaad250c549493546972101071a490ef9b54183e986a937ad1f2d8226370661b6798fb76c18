'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const _ = require("lodash");
class DefineObject {
    constructor(desc, exec) {
        this.exec = exec;
        this.opts = {
            '@DefineObjectOpts': true,
            __preParsed: false,
            desc: desc || '(unknown description/title/name)',
        };
    }
    inject() {
        return this;
    }
    plan(v) {
        assert(Number.isInteger(v), 'Argument to plan must be an integer.');
        this.opts.plan = v;
        return this;
    }
    desc(v) {
        assert.equal(typeof v, 'string', 'Value for "desc" must be a string.');
        this.opts.desc = v;
        return this;
    }
    title(v) {
        assert.equal(typeof v, 'string', 'Value for "title" must be a string.');
        this.opts.desc = v;
        return this;
    }
    name(v) {
        assert.equal(typeof v, 'string', 'Value for "name" must be a string.');
        this.opts.desc = v;
        return this;
    }
    description(v) {
        assert.equal(typeof v, 'string', 'Value for "description" must be a string.');
        this.opts.desc = v;
        return this;
    }
    skip(v) {
        assert.equal(typeof v, 'boolean', 'Value for "skip" must be a boolean.');
        this.opts.skip = v;
        return this;
    }
    only(v) {
        assert.equal(typeof v, 'boolean', 'Value for "only" must be a boolean.');
        this.opts.only = v;
        return this;
    }
    parallel(v) {
        assert.equal(typeof v, 'boolean', 'Value for "first" must be a boolean.');
        this.opts.parallel = v;
        return this;
    }
    series(v) {
        assert.equal(typeof v, 'boolean', 'Value for "first" must be a boolean.');
        this.opts.series = v;
        return this;
    }
    mode(v) {
        assert.equal(typeof v, 'string', 'Value for "mode" must be a string.');
        this.opts.mode = v;
        return this;
    }
    timeout(v) {
        assert(Number.isInteger(v), 'Timeout value must be an integer.');
        this.opts.timeout = v;
        return this;
    }
}
exports.DefineObject = DefineObject;
class DefineObjectTestOrHook extends DefineObject {
    throws(v) {
        if (typeof v === 'string') {
            v = new RegExp(v);
        }
        if (!(v instanceof RegExp)) {
            throw new Error('Value for "throws" must be a String or regular expression (RegExp instance).');
        }
        this.opts.throws = v;
        return this;
    }
    cb(v) {
        assert.equal(typeof v, 'boolean', 'Value for "cb" must be a boolean.');
        this.opts.cb = Boolean(v);
        return this;
    }
    fatal(v) {
        assert.equal(typeof v, 'boolean', 'Value for "fatal" must be a boolean.');
        this.opts.fatal = v;
        return this;
    }
    events() {
        const successEvents = this.opts.successEvents = this.opts.successEvents || [];
        _.flattenDeep([Array.from(arguments)]).forEach(function (v) {
            assert(v, 'Value was going to be added to "successEvents", but value is falsy');
            assert.equal(typeof v, 'string', 'Value for "successEvent" must be a string.');
            successEvents.push(v);
        });
        return this;
    }
    successEvents(...args) {
        const successEvents = this.opts.successEvents = this.opts.successEvents || [];
        _.flattenDeep([args]).forEach(function (v) {
            assert(v, 'Value was going to be added to "successEvents", but value is falsy');
            assert.equal(typeof v, 'string', 'Value for "successEvent" must be a string.');
            successEvents.push(v);
        });
        return this;
    }
    successEvent(...args) {
        const successEvents = this.opts.successEvents = this.opts.successEvents || [];
        _.flattenDeep([Array.from(arguments)]).forEach(function (v) {
            assert(v, 'Value was going to be added to "successEvents", but value is falsy');
            assert.equal(typeof v, 'string', 'Value for "successEvent" must be a string.');
            successEvents.push(v);
        });
        return this;
    }
    errorEvents(...args) {
        const errorEvents = this.opts.errorEvents = this.opts.errorEvents || [];
        _.flattenDeep([Array.from(arguments)]).forEach(function (v) {
            assert(v, 'Value was going to be added to "errorEvents", but value is falsy');
            assert.equal(typeof v, 'string', 'Value for "errorEvent" must be a string.');
            errorEvents.push(v);
        });
        return this;
    }
    errorEvent(...args) {
        const errorEvents = this.opts.errorEvents = this.opts.errorEvents || [];
        _.flattenDeep([Array.from(arguments)]).forEach(function (v) {
            assert(v, 'Value was going to be added to "errorEvents", but value is falsy');
            assert.equal(typeof v, 'string', 'Value for "errorEvent" must be a string.');
            errorEvents.push(v);
        });
        return this;
    }
}
exports.DefineObjectTestOrHook = DefineObjectTestOrHook;
class DefineOptionsInjectHook extends DefineObjectTestOrHook {
    run(fn) {
        const name = this.opts.desc || '(unknown DefineObject name)';
        this.exec.call(null, name, Object.assign({}, this.opts), fn);
        return this;
    }
}
exports.DefineOptionsInjectHook = DefineOptionsInjectHook;
class DefineObjectAllHook extends DefineObjectTestOrHook {
    first(v) {
        assert.equal(typeof v, 'boolean', 'Value for "first" must be a boolean.');
        this.opts.first = v;
        return this;
    }
    last(v) {
        assert.equal(typeof v, 'boolean', 'Value for "last" must be a boolean.');
        this.opts.last = v;
        return this;
    }
    always(v) {
        assert.equal(typeof v, 'boolean', 'Value for "always" must be a boolean.');
        this.opts.always = v;
        return this;
    }
    run(fn) {
        const name = this.opts.desc || '(unknown DefineObject name)';
        this.exec.call(null, name, Object.assign({}, this.opts), fn);
        return this;
    }
}
exports.DefineObjectAllHook = DefineObjectAllHook;
class DefineObjectEachHook extends DefineObjectTestOrHook {
    fatal(v) {
        assert.equal(typeof v, 'boolean', 'Value for "fatal" must be a boolean.');
        this.opts.fatal = v;
        return this;
    }
    run(fn) {
        const name = this.opts.desc || '(unknown DefineObject name)';
        this.exec.call(null, name, Object.assign({}, this.opts), fn);
        return this;
    }
}
exports.DefineObjectEachHook = DefineObjectEachHook;
class DefineObjectTestCase extends DefineObjectTestOrHook {
    run(fn) {
        const name = this.opts.desc || '(unknown DefineObject name)';
        this.exec.call(null, name, Object.assign({}, this.opts), fn);
        return this;
    }
}
exports.DefineObjectTestCase = DefineObjectTestCase;
class DefineObjectContext extends DefineObject {
    source(...args) {
        this.opts.__toBeSourcedForIOC = this.opts.__toBeSourcedForIOC || {};
        const self = this;
        args.forEach(function (a) {
            if (Array.isArray(a)) {
                self.source(...a);
            }
            else if (typeof a === 'string') {
                self.opts.__toBeSourcedForIOC[a] = true;
            }
            else {
                throw new Error('argument must be a string or an array of strings.');
            }
        });
        return this;
    }
    names(...args) {
        this.opts.names = args.reduce(function (a, b) {
            return a.concat(b);
        }, []);
        return this;
    }
    run(fn) {
        const name = this.opts.desc || '(unknown DefineObject name)';
        this.exec.call(null, name, Object.assign({}, this.opts), fn);
        return this;
    }
}
exports.DefineObjectContext = DefineObjectContext;
