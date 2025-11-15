#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("../src/main");
async function testWriterExclusiveDuringReaders() {
    console.log('=== Test: writer exclusive during readers (Broker) ===');
    const port = 9501;
    const broker = new main_1.Broker({ port });
    const client = new main_1.RWLockWritePrefClient({ port });
    try {
        await broker.ensure();
        await client.ensure();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timed out'));
            }, 15000);
            const key = 'writer-exclusive';
            let readersAcquired = 0;
            const readerReleases = [];
            let writerAcquired = false;
            for (let i = 0; i < 3; i++) {
                client.acquireReadLock(key, { lockRequestTimeout: 10000 }, (err, release) => {
                    if (err) {
                        clearTimeout(timeout);
                        return reject(err);
                    }
                    readersAcquired++;
                    readerReleases.push(release);
                    console.log(`  ✓ Reader ${readersAcquired}/3 acquired`);
                    if (readersAcquired === 3) {
                        setTimeout(() => {
                            let released = 0;
                            const releaseTimeout = setTimeout(() => {
                                if (released < 3) {
                                    clearTimeout(timeout);
                                    return reject(new Error(`Only ${released}/3 readers released after timeout`));
                                }
                            }, 5000);
                            console.log('  → Releasing all readers...');
                            readerReleases.forEach((r, index) => {
                                r((err, val) => {
                                    if (err) {
                                        clearTimeout(releaseTimeout);
                                        clearTimeout(timeout);
                                        return reject(err);
                                    }
                                    released++;
                                    console.log(`  ✓ Reader ${index + 1} released (${released}/3)`);
                                    if (released === 3) {
                                        clearTimeout(releaseTimeout);
                                        console.log('  → All readers released, acquiring write lock...');
                                        client.acquireWriteLock(key, { lockRequestTimeout: 10000 }, (err2, releaseWrite) => {
                                            if (err2) {
                                                clearTimeout(timeout);
                                                return reject(new Error('Writer should acquire after readers release: ' + err2.message));
                                            }
                                            console.log('  ✓ Write lock acquired');
                                            writerAcquired = true;
                                            releaseWrite((err3, val3) => {
                                                if (err3) {
                                                    clearTimeout(timeout);
                                                    return reject(err3);
                                                }
                                                console.log('  ✓ Write lock released');
                                                clearTimeout(timeout);
                                                setTimeout(() => {
                                                    client.close();
                                                    broker.close(() => {
                                                        resolve(true);
                                                    });
                                                }, 100);
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
    }
    catch (err) {
        await broker.close(() => { });
        client.close();
        throw err;
    }
}
async function main() {
    try {
        const result = await testWriterExclusiveDuringReaders();
        console.log('\n✅ Test PASSED');
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ Test FAILED:', err.message);
        process.exit(1);
    }
}
main();
