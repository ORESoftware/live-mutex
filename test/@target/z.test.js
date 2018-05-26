'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const suman = require("suman");
const Test = suman.init(module);
const dist_1 = require("../../dist");
/////////////////////////////////////////////////////
Test.create({ mode: 'parallel' }, ['lmUtils', function (b, assert, before, it) {
        const { lmUtils } = b.ioc;
        const conf = Object.freeze({ port: 7888 });
        before('promise', function () {
            return lmUtils.conditionallyLaunchSocketServerp(conf);
        });
        it.cb('yes', { timeout: 30000 }, t => {
            const client = new dist_1.Client(conf, (err, c) => {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            });
        });
        it.cb('yes', { timeout: 30000 }, t => {
            new dist_1.Client(conf, function (err, c) {
                if (err)
                    return t(err);
                this.lock('z', function (err) {
                    if (err)
                        return t(err);
                    this.unlock('z', t.done);
                });
            });
        });
        it.cb('yes', { timeout: 30000 }, t => {
            const client = new dist_1.Client(conf);
            return client.ensure(function (err, c) {
                if (err)
                    return t(err);
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            });
        });
        it.cb('yes', { timeout: 30000 }, t => {
            const client = new dist_1.Client(conf);
            client.ensure().then(function (c) {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t.done);
                });
            });
        });
    }]);
