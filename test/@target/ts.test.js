'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const suman_1 = require("suman");
const Test = suman_1.default.init(module);
// import the other way, just to be sure
const live_mutex_1 = require("live-mutex");
/////////////////////////////////////////////////////////////////////
Test.create([function (b, inject, describe, before, it, $deps, $core) {
        const { fs, path, assert } = $core;
        const { chalk: colors, async, lodash: _ } = $deps;
        const conf = Object.freeze({ port: 7027 });
        inject(j => {
            j.register('broker', new live_mutex_1.Broker(conf).ensure());
        });
        inject(j => {
            j.register('client', new live_mutex_1.Client(conf).ensure());
        });
        const f = require.resolve('../fixtures/corruptible.txt');
        before.cb('remove file', function (t) {
            fs.writeFile(f, '', t);
        });
        describe('inject', b => {
            const c = b.getInjectedValue('client');
            const lockWriteRelease = function (val, cb) {
                c.lock('a', function (err, { unlock }) {
                    if (err) {
                        return cb(err);
                    }
                    fs.appendFile(f, '\n' + String(val), function (err) {
                        err ? cb(err) : unlock(cb);
                    });
                });
            };
            before.cb('write like crazy', { timeout: 30000 }, t => {
                const a = Array.apply(null, { length: 20 }).map((item, index) => index);
                async.each(a, lockWriteRelease, t.done);
            });
            it.cb('ensure that file still has the same stuff in it!', { timeout: 30000 }, t => {
                fs.readFile(f, function (err, data) {
                    if (err) {
                        return t.fail(err);
                    }
                    const arr = String(data).split('\n').filter(function (line) {
                        return String(line).trim().length > 0;
                    });
                    arr.forEach(function (item, index) {
                        assert.equal(String(item), String(index), 'item and index are not equal');
                    });
                    t.done();
                });
            });
        });
    }]);
