'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const suman = require("suman");
const { Test } = suman.init(module);
global.Promise = require('bluebird');
const dist_1 = require("../../dist");
///////////////////////////////////////////////////////////////////////////////////////
Test.create(['Promise', function (b, it, inject, describe, before, $deps) {
        const { Promise } = b.ioc;
        const { chalk: colors } = $deps;
        const conf = Object.freeze({ port: 7035 });
        before(h => new dist_1.Broker(conf).start());
        before('get client', h => {
            return new dist_1.Client(conf).ensure().then(function (c) {
                h.supply.client = c;
            });
        });
        describe('do all in parallel', { parallel: true }, b => {
            describe('injected', function (b) {
                it('locks/unlocks', t => {
                    const c = t.supply.client;
                    return c.lockp('a').then(function (v) {
                        return c.unlockp('a');
                    });
                });
            });
            it('locks/unlocks', t => {
                const c = t.supply.client;
                return c.lockp('a').then(function (v) {
                    return c.unlockp('a');
                });
            });
            const makePromiseProvider = function (unlock) {
                return function (input) {
                    return Promise.resolve(input).then(function () {
                        return new Promise(function (resolve, reject) {
                            unlock(function (err) {
                                err ? reject(err) : resolve();
                            });
                        });
                    });
                };
            };
            it('locks/unlocks super special 1', t => {
                const c = t.supply.client;
                return c.lockp('foo').then(function ({ unlock }) {
                    return c.promisifyUnlock(unlock);
                });
            });
            it('locks/unlocks super special 2', (t) => __awaiter(this, void 0, void 0, function* () {
                const c = t.supply.client;
                const { unlock } = yield c.acquire('foo');
                return c.promisifyUnlock(unlock);
            }));
            it('locks/unlocks super special 2', (t) => __awaiter(this, void 0, void 0, function* () {
                const c = t.supply.client;
                const { unlock } = yield c.lockp('foo');
                const provider = makePromiseProvider(unlock);
                // do some other async stuff
                const v = yield Promise.resolve(123);
                return provider(String(v));
            }));
            it('locks/unlocks super special 3', t => {
                const c = t.supply.client;
                return c.lockp('foo').then(function ({ unlock }) {
                    return new Promise(function (resolve, reject) {
                        unlock(function (err) {
                            err ? reject(err) : resolve();
                        });
                    });
                });
            });
            it('locks/unlocks', (t) => __awaiter(this, void 0, void 0, function* () {
                const c = t.supply.client;
                yield c.lockp('a');
                yield Promise.delay(100);
                return c.unlockp('a');
            }));
        });
    }]);
