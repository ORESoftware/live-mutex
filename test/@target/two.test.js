'use strict';
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module).Test;
var dist_1 = require("../../dist");
///////////////////////////////////////////////////////////
Test.create(['Promise', function (b, assert, describe, inject, it, $deps, $core) {
        var Promise = b.ioc.Promise;
        var _ = $deps.lodash, async = $deps.async, colors = $deps.chalk;
        var arrays = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 2, 1, 2, 111, 2, 2, 21, 1, 11, 1, 111, 1, 111, 1, 2, 2, 2, 2, 1, 2, 21, 11, 11111, 111, 1, 11, 1, 1, 1, 1, 1, 1, 1],
            ['a', 'a', 'a1', 'a2', 'a2', 'a2', 'a1', 'a2'],
            [1, 2, 3, 4, 5, 6, 7, 8, 9]
        ];
        var conf = Object.freeze({ port: 7037 });
        inject(function (j) {
            j.register('broker', new dist_1.Broker(conf).ensure());
        });
        inject(function (j) {
            j.register('client', new dist_1.Client(conf).ensure());
        });
        describe('inject', function (b) {
            var c = b.getInjectedValue('client');
            arrays.forEach(function (a) {
                describe.delay('resumes', function (b) {
                    async.map(a, function (val, cb) {
                        cb(null, function (t) {
                            c.lock(String(val), function (err, v) {
                                if (err) {
                                    return t.fail(err);
                                }
                                setTimeout(function () {
                                    c.unlock(String(val), {
                                        force: false,
                                        _uuid: v.lockUuid
                                    }, t.done);
                                }, 100);
                            });
                        });
                    }, function (err, results) {
                        if (err) {
                            throw err;
                        }
                        b.resume(results);
                    });
                    describe.parallel('handles results', function (b) {
                        var fns = b.getResumeValue();
                        fns.forEach(function (fn) {
                            it.cb('locks/unlocks', fn);
                        });
                    });
                });
            });
        });
    }]);
