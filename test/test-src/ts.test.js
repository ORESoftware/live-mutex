"use strict";
var suman = require("suman");
function decoratorExpression(target) {
    target.annotated = true;
}
var Test = suman.init(module, {});
var colors = require('colors/safe');
var async = require('async');
var _ = require('lodash');
var live_mutex_1 = require("live-mutex");
Test.create(__filename, {}, function (assert, fs, path, inject) {
    var conf = Object.freeze({ port: 7027 });
    inject('yes', function () {
        return {
            broker: new live_mutex_1.Broker(conf).ensure()
        };
    });
    inject('yes', function () {
        return {
            c: new live_mutex_1.Client(conf).ensure()
        };
    });
    var f = require.resolve('../fixtures/corruptible.txt');
    this.before.cb('remove file', function (t) {
        fs.writeFile(f, '', t);
    });
    this.describe('inject', function (c) {
        function lockWriteRelease(val, cb) {
            c.lock('a', function (err, unlock) {
                if (err) {
                    cb(err);
                }
                else {
                    fs.appendFile(f, '\n' + String(val), function (err) {
                        if (err) {
                            cb(err);
                        }
                        else {
                            unlock(cb);
                        }
                    });
                }
            });
        }
        this.before.cb('write like crazy', { timeout: 30000 }, function (t) {
            var a = Array.apply(null, { length: 20 }).map(function (item, index) { return index; });
            async.each(a, lockWriteRelease, t.done);
        });
        this.it.cb('ensure that file still has the same stuff in it!', { timeout: 30000 }, function (t) {
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
