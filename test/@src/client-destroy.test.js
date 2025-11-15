'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
process.on('uncaughtException', e => {
    console.log(util.inspect(e));
});
const suman_1 = require("suman");
const Test = suman_1.default.init(module);
const async = require("async");
const live_mutex_1 = require("live-mutex");
Test.create([function (b, inject, describe, before, it, $deps, $core) {
        const { fs, path, assert } = $core;
        const { chalk: colors, lodash: _ } = $deps;
        console.log('suman child id:', process.env.SUMAN_CHILD_ID);
        const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
        const conf = Object.freeze({ port });
        inject(j => {
            const brokerConf = Object.assign({}, conf, { noListen: process.env.lmx_broker_no_listen === 'yes' });
            j.register('broker', new live_mutex_1.Broker1(brokerConf).ensure());
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
            const broker = b.getInjectedValue('broker');
            it.cb('Locks before new connection', { timeout: 10000 }, t => {
                let i = 0;
                async.times(5, (n, cb) => {
                    c.lock('foo' + n, (err, val) => {
                        console.log({ err, val });
                        if (err) {
                            return cb(null);
                        }
                        t.unlock();
                        cb(null);
                    });
                }, (err, val) => {
                    t.done();
                });
                c.createNewConnection();
            });
            it.cb('Locks after new connection', { timeout: 10000 }, t => {
                async.times(5, (n, cb) => {
                    c.lock('foo' + n, (err, val) => {
                        console.log({ err, val });
                        cb(null);
                    });
                }, t.done);
            });
        });
    }]);
