'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const suman = require("suman");
const { Test } = suman.init(module);
const dist_1 = require("../../dist");
///////////////////////////////////////////////////////////////
Test.create(['Promise', function (b, it, inject, describe, before, $deps) {
        const { Promise } = b.ioc;
        const { chalk: colors } = $deps;
        const conf = Object.freeze({ port: 7034 });
        inject(() => {
            return {
                broker: new dist_1.Broker(conf).ensure()
            };
        });
        let c;
        before('get client', h => {
            return new dist_1.Client(conf).ensure().then(function (client) {
                c = client;
            });
        });
        describe('injected', function (b) {
            it.cb('locks/unlocks', t => {
                c.lock('a', {}, function (err, v) {
                    if (err) {
                        return t.fail(err);
                    }
                    setTimeout(function () {
                        v.unlock(t.done);
                    }, 1500);
                });
            });
            it.cb('locks/unlocks', t => {
                c.lock('a', 1100, function (err, v) {
                    if (err) {
                        return t.fail(err);
                    }
                    setTimeout(function () {
                        c.unlock('a', v.lockUuid, t.done);
                    }, 1000);
                });
            });
            it.cb('locks/unlocks', t => {
                c.lock('a', {}, function (err, v) {
                    if (err) {
                        return t.fail(err);
                    }
                    setTimeout(function () {
                        c.unlock('a', t.done);
                    }, 1000);
                });
            });
        });
    }]);
