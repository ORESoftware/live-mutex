'use strict';
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module);
/////////////////////////////////////////////////////////
Test.create({ mode: 'series' }, ['LvMtxClient', 'lmUtils', 'Promise', function (b, assert, before, it) {
        var _a = b.ioc, LvMtxClient = _a.LvMtxClient, lmUtils = _a.lmUtils, Promise = _a.Promise;
        var conf = Object.freeze({ port: 7988 });
        before('promise', function () {
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
        it('yes', { timeout: 1500 }, function (t) {
            return LvMtxClient.create(conf).ensure().then(function (c) {
                return c.lockp('z').then(function (_a) {
                    var lockUuid = _a.lockUuid;
                    return c.unlockp('z', lockUuid);
                });
            });
        });
        it('yes', { timeout: 1500 }, function (t) {
            var c = new LvMtxClient(conf);
            return c.ensure().then(function () {
                return c.lockp('z').then(function () {
                    return c.unlockp('z', true);
                });
            });
        });
        it('yes', { timeout: 1500 }, function (t) {
            return LvMtxClient.create(conf).ensure().then(function (c) {
                return c.lockp('z').then(function () {
                    return c.unlockp('z');
                });
            });
        });
        it('yes', { timeout: 1500 }, function (t) {
            return LvMtxClient.create(conf).ensure().then(function (c) {
                return c.lockp('z').then(function () {
                    return c.unlockp('z');
                });
            });
        });
        it('yes', { timeout: 1500 }, function (t) {
            return LvMtxClient.create(conf).ensure().then(function (c) {
                return c.lockp('z').then(function () {
                    return c.unlockp('z');
                });
            });
        });
    }]);
