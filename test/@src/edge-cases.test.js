'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const suman = require("suman");
const { Test } = suman.init(module);
const main_1 = require("../../dist/main");
Test.create(['Promise', function (b, it, inject, describe, before, $deps) {
        const { Promise } = b.ioc;
        const { chalk: colors } = $deps;
        console.log('suman child id:', process.env.SUMAN_CHILD_ID);
        const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
        const conf = Object.freeze({ port });
        const handleEvents = function (v) {
            v.emitter.on('warning', w => {
                console.error('warning:', w);
            });
            v.emitter.on('error', w => {
                console.error('error:', w);
            });
            return v;
        };
        inject(() => {
            const brokerConf = Object.assign({}, conf, { noListen: process.env.lmx_broker_no_listen === 'yes' });
            return {
                broker: new main_1.Broker1(brokerConf).ensure().then(handleEvents)
            };
        });
        before('get client', h => {
            return new main_1.Client(conf).ensure().then(function (client) {
                h.supply.client = handleEvents(client);
            });
        });
        describe('edge cases', function (b) {
            it.cb('lock with very short timeout should fail', t => {
                const c = t.supply.client;
                c.lock('timeout-test', {}, (err, unlock1) => {
                    if (err) {
                        return t.fail(err);
                    }
                    c.lock('timeout-test', { lockRequestTimeout: 50 }, (err2, unlock2) => {
                        if (!err2) {
                            unlock2(() => { });
                            return t.fail(new Error('Expected timeout error but got lock'));
                        }
                        if (err2.message && err2.message.includes('timeout')) {
                            unlock1(() => {
                                t.done();
                            });
                        }
                        else {
                            unlock1(() => { });
                            t.fail(new Error('Expected timeout error, got: ' + err2.message));
                        }
                    });
                });
            });
            it.cb('unlock with invalid id should fail gracefully', t => {
                const c = t.supply.client;
                c.unlock('never-locked-key', 'some-invalid-uuid', (err) => {
                    t.done();
                });
            });
            it.cb('semaphore: verify max is strictly enforced', t => {
                const c = t.supply.client;
                const max = 3;
                let concurrent = 0;
                let maxConcurrent = 0;
                const locks = [];
                let completed = 0;
                const total = 10;
                const checkMax = () => {
                    if (concurrent > max) {
                        return t.fail(new Error(`Concurrent locks (${concurrent}) exceeded max (${max})`));
                    }
                    maxConcurrent = Math.max(maxConcurrent, concurrent);
                };
                for (let i = 0; i < total; i++) {
                    c.lock('semaphore-strict', { max }, (err, unlock) => {
                        if (err) {
                            return t.fail(err);
                        }
                        concurrent++;
                        checkMax();
                        locks.push(unlock);
                        setTimeout(() => {
                            concurrent--;
                            completed++;
                            unlock(() => {
                                if (completed === total) {
                                    if (maxConcurrent > max) {
                                        return t.fail(new Error(`Max concurrent was ${maxConcurrent}, expected <= ${max}`));
                                    }
                                    t.done();
                                }
                            });
                        }, 10 + Math.random() * 20);
                    });
                }
            });
            it.cb('rapid lock/unlock cycles', t => {
                const c = t.supply.client;
                const cycles = 50;
                let completed = 0;
                const cycle = () => {
                    c.lock('rapid-cycle', {}, (err, unlock) => {
                        if (err) {
                            return t.fail(err);
                        }
                        setImmediate(() => {
                            unlock(() => {
                                completed++;
                                if (completed < cycles) {
                                    cycle();
                                }
                                else {
                                    t.done();
                                }
                            });
                        });
                    });
                };
                cycle();
            });
            it.cb('multiple keys simultaneously', t => {
                const c = t.supply.client;
                const keys = ['key1', 'key2', 'key3', 'key4', 'key5'];
                let acquired = 0;
                const unlocks = [];
                keys.forEach(key => {
                    c.lock(key, {}, (err, unlock) => {
                        if (err) {
                            return t.fail(err);
                        }
                        acquired++;
                        unlocks.push({ key, unlock });
                        if (acquired === keys.length) {
                            unlocks.forEach(({ key: k, unlock: u }) => {
                                u(() => { });
                            });
                            t.done();
                        }
                    });
                });
            });
            it.cb('lock release order independence', t => {
                const c = t.supply.client;
                const unlocks = [];
                let acquired = 0;
                for (let i = 0; i < 5; i++) {
                    c.lock('order-test', {}, (err, unlock) => {
                        if (err) {
                            return t.fail(err);
                        }
                        acquired++;
                        unlocks.push(unlock);
                        if (acquired === 5) {
                            for (let j = unlocks.length - 1; j >= 0; j--) {
                                unlocks[j](() => { });
                            }
                            t.done();
                        }
                    });
                }
            });
            it.cb('semaphore: all slots filled then released', { timeout: 5000 }, t => {
                const c = t.supply.client;
                const max = 5;
                const unlocks = [];
                let acquired = 0;
                let extraLockAcquired = false;
                for (let i = 0; i < max; i++) {
                    c.lock('semaphore-fill', { max }, (err, unlock) => {
                        if (err) {
                            return t.fail(err);
                        }
                        acquired++;
                        unlocks.push(unlock);
                        if (acquired === max) {
                            c.lock('semaphore-fill', { max, lockRequestTimeout: 200 }, (err2, unlock2) => {
                                if (!err2) {
                                    extraLockAcquired = true;
                                    unlock2(() => { });
                                }
                                unlocks.forEach(u => u(() => { }));
                                t.done();
                            });
                        }
                    });
                }
            });
        });
    }]);
