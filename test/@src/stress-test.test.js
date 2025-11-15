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
        before('get clients', h => {
            const clients = [];
            const clientPromises = [];
            for (let i = 0; i < 20; i++) {
                const client = new main_1.Client(conf);
                clientPromises.push(client.ensure().then(c => {
                    handleEvents(c);
                    return c;
                }));
            }
            return Promise.all(clientPromises).then(clients => {
                h.supply.clients = clients;
            });
        });
        describe('stress tests', function (b) {
            it.cb('high concurrency semaphore', { timeout: 30000 }, t => {
                const clients = b.supply.clients;
                const max = 10;
                const totalOps = 100;
                let concurrent = 0;
                let maxConcurrent = 0;
                let completed = 0;
                const key = 'stress-semaphore';
                const checkMax = () => {
                    if (concurrent > max) {
                        return t.fail(new Error(`Concurrent (${concurrent}) > max (${max})`));
                    }
                    maxConcurrent = Math.max(maxConcurrent, concurrent);
                };
                for (let i = 0; i < totalOps; i++) {
                    const client = clients[i % clients.length];
                    client.lock(key, { max, lockRequestTimeout: 10000 }, (err, unlock) => {
                        if (err) {
                            return t.fail(err);
                        }
                        concurrent++;
                        checkMax();
                        setTimeout(() => {
                            concurrent--;
                            completed++;
                            unlock(() => {
                                if (completed === totalOps) {
                                    if (maxConcurrent !== max) {
                                        return t.fail(new Error(`Max concurrent was ${maxConcurrent}, expected ${max}`));
                                    }
                                    t.done();
                                }
                            });
                        }, 5 + Math.random() * 15);
                    });
                }
            });
            it.cb('many keys simultaneously', { timeout: 30000 }, t => {
                const clients = b.supply.clients;
                const numKeys = 50;
                let acquired = 0;
                const unlocks = [];
                for (let i = 0; i < numKeys; i++) {
                    const client = clients[i % clients.length];
                    const key = `stress-key-${i}`;
                    client.lock(key, {}, (err, unlock) => {
                        if (err) {
                            return t.fail(err);
                        }
                        acquired++;
                        unlocks.push({ key, unlock });
                        if (acquired === numKeys) {
                            unlocks.forEach(({ unlock: u }) => u(() => { }));
                            t.done();
                        }
                    });
                }
            });
            it.cb('rapid sequential operations', { timeout: 30000 }, t => {
                const client = b.supply.clients[0];
                const cycles = 200;
                let completed = 0;
                const key = 'rapid-sequential';
                const cycle = () => {
                    client.lock(key, {}, (err, unlock) => {
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
            it.cb('mixed semaphore sizes', { timeout: 30000 }, t => {
                const clients = b.supply.clients;
                const configs = [
                    { key: 'sem-2', max: 2 },
                    { key: 'sem-5', max: 5 },
                    { key: 'sem-10', max: 10 },
                ];
                let totalOps = 0;
                let completed = 0;
                configs.forEach(({ key, max }) => {
                    for (let i = 0; i < 20; i++) {
                        totalOps++;
                        const client = clients[i % clients.length];
                        client.lock(key, { max, lockRequestTimeout: 5000 }, (err, unlock) => {
                            if (err) {
                                return t.fail(err);
                            }
                            setTimeout(() => {
                                completed++;
                                unlock(() => {
                                    if (completed === totalOps) {
                                        t.done();
                                    }
                                });
                            }, 5 + Math.random() * 10);
                        });
                    }
                });
            });
        });
    }]);
