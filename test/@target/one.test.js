'use strict';
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module).Test;
var dist_1 = require("../../dist");
///////////////////////////////////////////////////////////////
Test.create(['Promise', function (b, it, inject, describe, before, $deps) {
        var Promise = b.ioc.Promise;
        var colors = $deps.chalk;
        var conf = Object.freeze({ port: 7034 });
        inject(function () {
            return {
                broker: new dist_1.Broker(conf).ensure()
            };
        });
        var c;
        before('get client', function (h) {
            return new dist_1.Client(conf).ensure().then(function (client) {
                c = client;
            });
        });
        describe('injected', function (b) {
            it.cb('locks/unlocks', function (t) {
                c.lock('a', {}, function (err, v) {
                    if (err) {
                        return t.fail(err);
                    }
                    setTimeout(function () {
                        v.unlock(t.done);
                    }, 1500);
                });
            });
            it.cb('locks/unlocks', function (t) {
                c.lock('a', 1100, function (err, v) {
                    if (err) {
                        return t.fail(err);
                    }
                    setTimeout(function () {
                        c.unlock('a', v.lockUuid, t.done);
                    }, 1000);
                });
            });
            it.cb('locks/unlocks', function (t) {
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
