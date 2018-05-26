'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const suman = require("suman");
const Test = suman.init(module);
const dist_1 = require("../../dist");
const dist_2 = require("../../dist");
/////////////////////////////////////////////////////////
Test.create({ mode: 'series' }, ['Promise', function (b, assert, before, it) {
        const { Promise } = b.ioc;
        const conf = Object.freeze({ port: 7988 });
        before('promise', function () {
            return dist_2.lmUtils.conditionallyLaunchSocketServerp(conf)
                .then(function (data) {
                return Promise.delay(300);
            });
        });
        it('yes', { timeout: 1500 }, t => {
            return dist_1.LvMtxClient.create(conf).ensure().then(c => {
                return c.lockp('z').then(function ({ lockUuid }) {
                    return c.unlockp('z', lockUuid);
                });
            });
        });
        it('yes', { timeout: 1500 }, t => {
            const c = new dist_1.LvMtxClient(conf);
            return c.ensure().then(function () {
                return c.lockp('z').then(function () {
                    return c.unlockp('z', true);
                });
            });
        });
        it('yes', { timeout: 1500 }, t => {
            return dist_1.LvMtxClient.create(conf).ensure().then(c => {
                return c.lockp('z').then(function () {
                    return c.unlockp('z');
                });
            });
        });
        it('yes', { timeout: 1500 }, t => {
            return dist_1.LvMtxClient.create(conf).ensure().then(c => {
                return c.lockp('z').then(function () {
                    return c.unlockp('z');
                });
            });
        });
        it('yes', { timeout: 1500 }, t => {
            return dist_1.LvMtxClient.create(conf).ensure().then(c => {
                return c.lockp('z').then(() => {
                    return c.unlockp('z');
                });
            });
        });
    }]);
