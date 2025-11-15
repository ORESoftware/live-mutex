#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("../src/main");
async function testSimpleReadLock() {
    console.log('=== Simple Read Lock Test ===');
    const port = 9200;
    const broker = new main_1.Broker1({ port });
    const client = new main_1.RWLockWritePrefClient({ port });
    try {
        await broker.ensure();
        await client.ensure();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timed out'));
            }, 10000);
            console.log('  → Acquiring read lock...');
            client.acquireReadLock('test-key', {}, (err, release) => {
                if (err) {
                    clearTimeout(timeout);
                    return reject(err);
                }
                console.log('  ✓ Read lock acquired');
                console.log('  → Releasing read lock...');
                release((releaseErr) => {
                    clearTimeout(timeout);
                    if (releaseErr) {
                        console.error('  ✗ Release error:', releaseErr);
                        return reject(releaseErr);
                    }
                    console.log('  ✓ Read lock released');
                    setTimeout(() => {
                        client.close();
                        broker.close(() => {
                            resolve(true);
                        });
                    }, 100);
                });
            });
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
        const result = await testSimpleReadLock();
        console.log('\n✅ Test PASSED');
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ Test FAILED:', err.message);
        process.exit(1);
    }
}
main();
