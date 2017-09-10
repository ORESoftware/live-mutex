'use strict';
exports.__esModule = true;
var suman_1 = require("suman");
var Test = suman_1["default"].init(module);
// import the other way, just to be sure
var live_mutex_1 = require("live-mutex");
/////////////////////////////////////////////////////////////////////
Test.create(function (inject, describe, before, it, $deps, $core) {
    var fs = $core.fs, path = $core.path, assert = $core.assert;
    var colors = $deps.chalk, async = $deps.async, _ = $deps.lodash;
    var conf = Object.freeze({ port: 7027 });
    var p;
    inject(function () {
        return {
            broker: p = new live_mutex_1.Broker(conf).ensure()
        };
    });
    inject(function () {
        return {
            c: p.then(function (v) { return new live_mutex_1.Client(conf).ensure(); })
        };
    });
    var f = require.resolve('../fixtures/corruptible.txt');
    before.cb('remove file', function (t) {
        fs.writeFile(f, '', t);
    });
    describe('inject', function (c) {
        function lockWriteRelease(val, cb) {
            c.lock('a', function (err, unlock) {
                if (err) {
                    return cb(err);
                }
                fs.appendFile(f, '\n' + String(val), function (err) {
                    if (err) {
                        cb(err);
                    }
                    else {
                        unlock(cb);
                    }
                });
            });
        }
        before.cb('write like crazy', { timeout: 30000 }, function (t) {
            var a = Array.apply(null, { length: 20 }).map(function (item, index) { return index; });
            async.each(a, lockWriteRelease, t.done);
        });
        it.cb('ensure that file still has the same stuff in it!', { timeout: 30000 }, function (t) {
            fs.readFile(f, function (err, data) {
                if (err) {
                    return t.fail(err);
                }
                var arr = String(data).split('\n').filter(function (line) {
                    return String(line).trim().length > 0;
                });
                arr.forEach(function (item, index) {
                    assert.equal(String(item), String(index), 'item and index are not equal');
                });
                t.done(null);
            });
        });
    });
});
