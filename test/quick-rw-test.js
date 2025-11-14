#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
process.argv.push('--lmx-debug');
process.env.lmx_debug = 'yes';
const main_1 = require("../dist/main");
const port = 8000 + Math.floor(Math.random() * 100);
console.log('Using port:', port);
async function quickTest() {
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    console.log('Broker ready');
    const client = new main_1.RWLockWritePrefClient({ port });
    await client.ensure();
    console.log('Client ready');
    const key = 'test-key';
    // Simple write lock test
    console.log('Testing write lock...');
    await new Promise((resolve, reject) => {
        client.acquireWriteLock(key, {}, (err, release) => {
            if (err) {
                console.error('Write lock error:', err);
                return reject(err);
            }
            console.log('Write lock acquired');
            setTimeout(() => {
                release((releaseErr) => {
                    if (releaseErr) {
                        console.error('Write release error:', releaseErr);
                        return reject(releaseErr);
                    }
                    console.log('Write lock released');
                    resolve();
                });
            }, 100);
        });
    });
    // Simple read lock test
    console.log('Testing read lock...');
    await new Promise((resolve, reject) => {
        client.acquireReadLock(key, {}, (err, release) => {
            if (err) {
                console.error('Read lock error:', err);
                return reject(err);
            }
            console.log('Read lock acquired');
            setTimeout(() => {
                release((releaseErr) => {
                    if (releaseErr) {
                        console.error('Read release error:', releaseErr);
                        return reject(releaseErr);
                    }
                    console.log('Read lock released');
                    resolve();
                });
            }, 100);
        });
    });
    await new Promise(resolve => broker.close(() => resolve()));
    client.close();
    console.log('✅ Quick test passed!');
    process.exit(0);
}
quickTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
