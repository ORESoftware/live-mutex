'use strict';
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module);
var dist_1 = require("../../dist");
var dist_2 = require("../../dist");
/////////////////////////////////////////////////////////
Test.create({ mode: 'series' }, ['Promise', function (b, assert, before, it) {
        var Promise = b.ioc.Promise;
        var conf = Object.freeze({ port: 7988 });
        before('promise', function () {
            return dist_2.lmUtils.conditionallyLaunchSocketServerp(conf)
                .then(function (data) {
                return Promise.delay(300);
            });
        });
        it('yes', { timeout: 1500 }, function (t) {
            return dist_1.LvMtxClient.create(conf).ensure().then(function (c) {
                return c.lockp('z').then(function (_a) {
                    var lockUuid = _a.lockUuid;
                    return c.unlockp('z', lockUuid);
                });
            });
        });
        it('yes', { timeout: 1500 }, function (t) {
            var c = new dist_1.LvMtxClient(conf);
            return c.ensure().then(function () {
                return c.lockp('z').then(function () {
                    return c.unlockp('z', true);
                });
            });
        });
        it('yes', { timeout: 1500 }, function (t) {
            return dist_1.LvMtxClient.create(conf).ensure().then(function (c) {
                return c.lockp('z').then(function () {
                    return c.unlockp('z');
                });
            });
        });
        it('yes', { timeout: 1500 }, function (t) {
            return dist_1.LvMtxClient.create(conf).ensure().then(function (c) {
                return c.lockp('z').then(function () {
                    return c.unlockp('z');
                });
            });
        });
        it('yes', { timeout: 1500 }, function (t) {
            return dist_1.LvMtxClient.create(conf).ensure().then(function (c) {
                return c.lockp('z').then(function () {
                    return c.unlockp('z');
                });
            });
        });
    }]);
