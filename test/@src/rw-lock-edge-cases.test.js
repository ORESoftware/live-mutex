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
            return new main_1.RWLockWritePrefClient(conf).ensure().then(function (client) {
                h.supply.client = handleEvents(client);
            });
        });
        describe('RW lock edge cases', function (b) {
            it.cb('writer blocks all readers', { timeout: 15000 }, t => {
                const c = t.supply.client;
                const key = 'writer-blocks-readers';
                let writerAcquired = false;
                let readersStarted = 0;
                let readersAcquired = 0;
                const readerReleases = [];
                let writerReleased = false;
                c.acquireWriteLock(key, {}, (err, releaseWrite) => {
                    if (err) {
                        return t.fail(err);
                    }
                    writerAcquired = true;
                    for (let i = 0; i < 5; i++) {
                        readersStarted++;
                        c.acquireReadLock(key, { lockRequestTimeout: 10000 }, (err2, releaseRead) => {
                            if (err2) {
                                return t.fail(err2);
                            }
                            readersAcquired++;
                            readerReleases.push(releaseRead);
                            if (readersAcquired === 5) {
                                readerReleases.forEach(r => r(() => { }));
                                t.done();
                            }
                        });
                    }
                    setTimeout(() => {
                        if (!writerAcquired) {
                            return t.fail(new Error('Writer should have acquired lock'));
                        }
                        writerReleased = true;
                        releaseWrite(() => { });
                    }, 500);
                });
            });
            it.cb('readers can coexist', { timeout: 15000 }, t => {
                const c = t.supply.client;
                const key = 'readers-coexist';
                let readersAcquired = 0;
                const releases = [];
                const targetReaders = 10;
                for (let i = 0; i < targetReaders; i++) {
                    c.acquireReadLock(key, { lockRequestTimeout: 10000 }, (err, release) => {
                        if (err) {
                            return t.fail(err);
                        }
                        readersAcquired++;
                        releases.push(release);
                        if (readersAcquired === targetReaders) {
                            releases.forEach(r => r(() => { }));
                            t.done();
                        }
                    });
                }
            });
            it.cb('writer exclusive during readers', { timeout: 15000 }, t => {
                const c = t.supply.client;
                const key = 'writer-exclusive';
                let readersAcquired = 0;
                const readerReleases = [];
                let writerAcquired = false;
                for (let i = 0; i < 3; i++) {
                    c.acquireReadLock(key, { lockRequestTimeout: 10000 }, (err, release) => {
                        if (err) {
                            return t.fail(err);
                        }
                        readersAcquired++;
                        readerReleases.push(release);
                        if (readersAcquired === 3) {
                            setTimeout(() => {
                                let released = 0;
                                const releaseTimeout = setTimeout(() => {
                                    if (released < 3) {
                                        return t.fail(new Error(`Only ${released}/3 readers released after timeout`));
                                    }
                                }, 5000);
                                readerReleases.forEach((r, index) => {
                                    r((err, val) => {
                                        if (err) {
                                            clearTimeout(releaseTimeout);
                                            return t.fail(err);
                                        }
                                        released++;
                                        if (released === 3) {
                                            clearTimeout(releaseTimeout);
                                            c.acquireWriteLock(key, { lockRequestTimeout: 10000 }, (err2, releaseWrite) => {
                                                if (err2) {
                                                    return t.fail(new Error('Writer should acquire after readers release: ' + err2.message));
                                                }
                                                writerAcquired = true;
                                                releaseWrite((err3, val3) => {
                                                    if (err3) {
                                                        return t.fail(err3);
                                                    }
                                                    t.done();
                                                });
                                            });
                                        }
                                    });
                                });
                            }, 200);
                        }
                    });
                }
            });
            it.cb('rapid read/write cycles', { timeout: 60000 }, t => {
                const c = t.supply.client;
                const key = 'rapid-rw-cycles';
                const cycles = 10;
                let completed = 0;
                let isWrite = false;
                const cycle = () => {
                    if (isWrite) {
                        c.acquireWriteLock(key, { lockRequestTimeout: 10000 }, (err, release) => {
                            if (err) {
                                return t.fail(err);
                            }
                            setTimeout(() => {
                                release((err, val) => {
                                    if (err) {
                                        return t.fail(err);
                                    }
                                    completed++;
                                    isWrite = false;
                                    if (completed >= cycles) {
                                        t.done();
                                    }
                                    else if (completed < cycles) {
                                        cycle();
                                    }
                                });
                            }, 10);
                        });
                    }
                    else {
                        c.acquireReadLock(key, { lockRequestTimeout: 10000 }, (err, release) => {
                            if (err) {
                                return t.fail(err);
                            }
                            setTimeout(() => {
                                release((err, val) => {
                                    if (err) {
                                        return t.fail(err);
                                    }
                                    completed++;
                                    isWrite = true;
                                    if (completed >= cycles) {
                                        t.done();
                                    }
                                    else if (completed < cycles) {
                                        cycle();
                                    }
                                });
                            }, 10);
                        });
                    }
                };
                cycle();
            });
            it.cb('multiple keys with RW locks', { timeout: 15000 }, t => {
                const c = t.supply.client;
                const keys = ['rw-key1', 'rw-key2', 'rw-key3'];
                let acquired = 0;
                const releases = [];
                keys.forEach(key => {
                    c.acquireReadLock(key, { lockRequestTimeout: 10000 }, (err, release) => {
                        if (err) {
                            return t.fail(err);
                        }
                        acquired++;
                        releases.push({ key, release });
                        if (acquired === keys.length) {
                            releases.forEach(({ release: r }) => r(() => { }));
                            t.done();
                        }
                    });
                });
            });
            it.cb('write lock timeout when readers hold', { timeout: 15000 }, t => {
                const c = t.supply.client;
                const key = 'write-timeout';
                let readerAcquired = false;
                const readerRelease = [];
                c.acquireReadLock(key, { lockRequestTimeout: 10000 }, (err, release) => {
                    if (err) {
                        return t.fail(err);
                    }
                    readerAcquired = true;
                    readerRelease.push(release);
                    c.acquireWriteLock(key, { lockRequestTimeout: 300 }, (err2, releaseWrite) => {
                        if (!err2) {
                            releaseWrite(() => { });
                            readerRelease[0](() => { });
                            return t.fail(new Error('Write lock should timeout when reader holds lock'));
                        }
                        if (err2.message && err2.message.includes('timeout')) {
                            readerRelease[0](() => {
                                t.done();
                            });
                        }
                        else {
                            readerRelease[0](() => { });
                            t.fail(new Error('Expected timeout error, got: ' + err2.message));
                        }
                    });
                });
            });
        });
    }]);
