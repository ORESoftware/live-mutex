'use strict';
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module).Test;
///////////////////////////////////////////////////////////////
Test.create(['Broker', 'Client', function (b, it, inject, describe, before, $deps) {
        var _a = b.ioc, Broker = _a.Broker, Client = _a.Client;
        var colors = $deps.chalk;
        var conf = Object.freeze({ port: 7034 });
        inject(function () {
            return {
                broker: new Broker(conf).ensure()
            };
        });
        var c;
        before('get client', function (h) {
            return new Client(conf).ensure().then(function (client) {
                c = client;
            });
        });
        describe('injected', function (b) {
            it.cb('locks/unlocks', function (t) {
                c.lock('a', {}, function (err, unlock) {
                    if (err) {
                        return t.fail(err);
                    }
                    setTimeout(function () {
                        unlock(t.done);
                    }, 1500);
                });
            });
            it.cb('locks/unlocks', function (t) {
                c.lock('a', 1100, function (err, unlock, id) {
                    if (err) {
                        return t.fail(err);
                    }
                    setTimeout(function () {
                        c.unlock('a', id, t.done);
                    }, 1000);
                });
            });
            it.cb('locks/unlocks', function (t) {
                c.lock('a', {}, function (err, unlock, id) {
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
