'use strict';
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module);
/////////////////////////////////////////////////////////
Test.create({ mode: 'series' }, ['Client', 'lmUtils', 'Promise', function (b, assert, before, it) {
        var _a = b.ioc, Client = _a.Client, lmUtils = _a.lmUtils, Promise = _a.Promise;
        var conf = Object.freeze({ port: 7987 });
        before(function () {
            return lmUtils.conditionallyLaunchSocketServer(conf)
                .then(function (data) {
                return Promise.delay(30);
            }, function (err) {
                if (err) {
                    console.error(err.stack);
                }
                else {
                    throw new Error('no error passed to reject handler');
                }
            });
        });
        it.cb('yes', { timeout: 1500 }, function (t) {
            Client.create(conf, function (err, c) {
                if (err)
                    return t.fail(err);
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            });
        });
        it.cb('yes', { timeout: 1500 }, function (t) {
            var c = new Client(conf);
            c.ensure().then(function () {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            })["catch"](t);
        });
        it.cb('yes', { timeout: 1500 }, function (t) {
            Client.create(conf).then(function (c) {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            })["catch"](t);
        });
        it.cb('yes', { timeout: 1500 }, function (t) {
            Client.create(conf).then(function (c) {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            })["catch"](t);
        });
        it.cb('yes', { timeout: 1500 }, function (t) {
            Client.create(conf).then(function (c) {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            })["catch"](t);
        });
    }]);
