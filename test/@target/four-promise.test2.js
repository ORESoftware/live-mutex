'use strict';
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module);
/////////////////////////////////////////////////////////
Test.create({ mode: 'series' }, function (assert, before, it, LvMtxClient, lmUtils, Promise) {
    var conf = Object.freeze({ port: 7988 });
    console.log('four promise tests');
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
        return LvMtxClient.create(conf).then(function (c) {
            return c.lockp('z').then(function (_a) {
                var lockUuid = _a.lockUuid;
                return c.unlockp('z', lockUuid);
            });
        });
    });
    it('yes', { timeout: 1500 }, function (t) {
        throw new Error('bogus');
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
        return LvMtxClient.create(conf).then(function (c) {
            return c.lockp('z').then(function () {
                return c.unlockp('z');
            });
        });
    });
    it('yes', { timeout: 1500 }, function (t) {
        return LvMtxClient.create(conf).then(function (c) {
            return c.lockp('z').then(function () {
                return c.unlockp('z');
            });
        });
    });
    it('yes', { timeout: 1500 }, function (t) {
        return LvMtxClient.create(conf).then(function (c) {
            return c.lockp('z').then(function () {
                return c.unlockp('z');
            });
        });
    });
});
