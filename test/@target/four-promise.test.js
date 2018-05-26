'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const suman = require("suman");
const Test = suman.init(module);
/////////////////////////////////////////////////////////
Test.create({ mode: 'series' }, ['Client', 'lmUtils', 'Promise', function (b, assert, before, it) {
        const { Client, lmUtils, Promise } = b.ioc;
        const conf = Object.freeze({ port: 7987 });
        before(function () {
            return lmUtils.conditionallyLaunchSocketServerp(conf)
                .then(function (data) {
                return Promise.delay(300);
            });
        });
        it.cb('yes', { timeout: 1500 }, t => {
            const c = Client.create(conf);
            c.ensure((err, c) => {
                if (err)
                    return t.fail(err);
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            });
        });
        it('yes', { timeout: 1500 }, t => {
            const c = new Client(conf);
            return c.ensure().then(function () {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            });
        });
        it.cb('yes', { timeout: 1500 }, t => {
            Client.create(conf).ensure().then(c => {
                c.lock('z', function (err) {
                    if (err)
                        return t(err);
                    c.unlock('z', t);
                });
            }).catch(t);
        });
        it.cb('yes', { timeout: 1500 }, t => {
            return Client.create(conf).ensure().then(c => {
                return c.lockp('z').then(function ({ unlock }) {
                    return unlock(t);
                });
            });
        });
        it('yes', { timeout: 1500 }, t => {
            return Client.create(conf).ensure().then((c) => {
                return c.lockp('z').then(() => {
                    return c.unlockp('z');
                });
            });
        });
    }]);
