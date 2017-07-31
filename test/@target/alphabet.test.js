"use strict";
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module);
var async = require('async');
Test.create(function (assert, before, describe, it, path, Client, Broker, lmUtils, fs, inject) {
    var alphabet = 'abcdefghijklmnopqrstuvwxyz';
    var a2z = alphabet.split('');
    assert.equal(a2z.length, 26, ' => Western alphabet is messed up.');
    var num = 100;
    var conf = Object.freeze({ port: 7028 });
    inject(function () {
        return {
            broker: new Broker(conf).ensure()
        };
    });
    var client;
    before('get client', function (h) {
        return new Client(conf).ensure().then(function (c) {
            client = c;
        });
    });
    var p = path.resolve(__dirname + '/../fixtures/alphabet.test');
    before.cb('clean up file', function (h) {
        fs.writeFile(p, '', h);
    });
    describe('post', function () {
        before.cb('yo', function (h) {
            async.each(a2z, function (val, cb) {
                client.lock('foo', function (err, unlock) {
                    var strm = fs.createWriteStream(p, { flags: 'a' });
                    for (var i = 0; i < num; i++) {
                        strm.write(val);
                    }
                    strm.end();
                    strm.once('finish', function () {
                        unlock(cb);
                    });
                });
            }, h.done);
        });
        it.cb('count characters => expect num*26', { timeout: 300 }, function (t) {
            fs.readFile(p, function (err, data) {
                if (err) {
                    return t.done(err);
                }
                else {
                    assert.equal(String(data).trim().length, (26 * num));
                    t.done();
                }
            });
        });
        it.cb('10 chars of each, in order', { timeout: 300 }, function (t) {
            var readable = fs.createReadStream(p);
            readable.once('error', t.fail);
            readable.once('end', t.done);
            readable.on('readable', function () {
                var index = 0;
                var chunk;
                while (null != (chunk = readable.read(1))) {
                    var temp = (index - (index % num)) / num;
                    assert.equal(String(chunk), alphabet[temp]);
                    index++;
                }
            });
        });
    });
});
