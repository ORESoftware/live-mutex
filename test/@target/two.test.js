var suman = require('suman');
var Test = suman.init(module);
var colors = require('colors/safe');
var async = require('async');
var _ = require('lodash');
Test.create(function (assert, describe, Client, Broker, inject, it) {
    var arrays = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 2, 1, 2, 111, 2, 2, 21, 1, 11, 1, 111, 1, 111, 1, 2, 2, 2, 2, 1, 2, 21, 11, 11111, 111, 1, 11, 1, 1, 1, 1, 1, 1, 1],
        ['a', 'a', 'a1', 'a2', 'a2', 'a2', 'a1', 'a2'],
        [1, 2, 3, 4, 5, 6, 7, 8, 9]
    ];
    var conf = Object.freeze({ port: 7037 });
    var p;
    inject(function () {
        return {
            broker: p = new Broker(conf).ensure()
        };
    });
    inject(function () {
        return {
            c: p.then(function (v) { return new Client(conf).ensure(); })
        };
    });
    var l = _.flattenDeep(arrays).length;
    console.log(' => length => ', l);
    describe('inject', function (c) {
        arrays.forEach(function (a) {
            describe.delay('resumes', function (resume) {
                async.map(a, function (val, cb) {
                    cb(null, function (t) {
                        c.lock(String(val), function (err, unlock, id) {
                            if (err) {
                                t.fail(err);
                            }
                            else {
                                setTimeout(function () {
                                    c.unlock(String(val), {
                                        force: false,
                                        _uuid: id
                                    }, t.done);
                                    // client.unlock(String(val), id, t.done);
                                }, 100);
                            }
                        });
                    });
                }, function (err, results) {
                    if (err) {
                        throw err;
                    }
                    resume(results);
                });
                describe('handles results', { parallel: true }, function () {
                    var fns = this.getResumeValue();
                    fns.forEach(function (fn) {
                        it.cb('locks/unlocks', fn);
                    });
                });
            });
        });
    });
});
