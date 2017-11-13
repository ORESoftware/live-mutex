"use strict";
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module);
/////////////////////////////////////////////////////
Test.create({ mode: 'parallel' }, ['Client', 'lmUtils', function (b, assert, before, it) {
        var _a = b.ioc, lmUtils = _a.lmUtils, Client = _a.Client;
        var conf = Object.freeze({ port: 7888 });
        before('promise', function () {
            return lmUtils.conditionallyLaunchSocketServer(conf)
                .then(null, function (err) {
                if (err) {
                    console.error(err.stack);
                }
                else {
                    throw new Error('no error passed to reject handler');
                }
            });
        });
        it.cb('yes', { timeout: 30000 }, function (t) {
            var client = new Client(conf, function () {
                client.lock('z', function (err) {
                    if (err)
                        return t(err);
                    client.unlock('z', t);
                });
            });
        });
        it.cb('yes', { timeout: 30000 }, function (t) {
            new Client(conf, function () {
                this.lock('z', function (err) {
                    if (err)
                        return t(err);
                    this.unlock('z', t.done);
                });
            });
        });
        it.cb('yes', { timeout: 30000 }, function (t) {
            var client = new Client(conf);
            client.ensure(function () {
                client.lock('z', function (err) {
                    if (err)
                        return t(err);
                    client.unlock('z', t);
                });
            });
        });
        it.cb('yes', { timeout: 30000 }, function (t) {
            var client = new Client(conf);
            client.ensure().then(function (c) {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t.done);
                });
            });
        });
    }]);
