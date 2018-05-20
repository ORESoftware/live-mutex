'use strict';
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module);
var dist_1 = require("../../dist");
/////////////////////////////////////////////////////
Test.create({ mode: 'parallel' }, ['lmUtils', function (b, assert, before, it) {
        var lmUtils = b.ioc.lmUtils;
        var conf = Object.freeze({ port: 7888 });
        before('promise', function () {
            return lmUtils.conditionallyLaunchSocketServerp(conf);
        });
        it.cb('yes', { timeout: 30000 }, function (t) {
            var client = new dist_1.Client(conf, function (err, c) {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            });
        });
        it.cb('yes', { timeout: 30000 }, function (t) {
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
        it.cb('yes', { timeout: 30000 }, function (t) {
            var client = new dist_1.Client(conf);
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
        it.cb('yes', { timeout: 30000 }, function (t) {
            var client = new dist_1.Client(conf);
            client.ensure().then(function (c) {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t.done);
                });
            });
        });
    }]);
