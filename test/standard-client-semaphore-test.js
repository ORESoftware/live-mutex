#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("../dist/main");
const PORT = 3333;
function log(message, data) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`);
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function test1_DefaultMaxIsOne(broker, clients) {
    log('Test 1: Default max should be 1 (exclusive lock)');
    try {
        const key = 'test-default-max';
        let concurrentHolders = 0;
        let maxConcurrent = 0;
        const acquired = [];
        const promises = clients.slice(0, 5).map((client, index) => new Promise((resolve) => {
            client.lock(key, {}, (err, unlock) => {
                if (err) {
                    log(`Client ${index} failed:`, err.message);
                    acquired[index] = false;
                    return resolve();
                }
                concurrentHolders++;
                maxConcurrent = Math.max(maxConcurrent, concurrentHolders);
                acquired[index] = true;
                log(`Client ${index} acquired lock (concurrent: ${concurrentHolders})`);
                setTimeout(() => {
                    concurrentHolders--;
                    unlock((unlockErr) => {
                        if (unlockErr)
                            log(`Client ${index} unlock error:`, unlockErr.message);
                        resolve();
                    });
                }, 100);
            });
        }));
        await Promise.all(promises);
        await delay(200);
        log('Test 1 results', { maxConcurrent, acquired: acquired.filter(Boolean).length });
        if (maxConcurrent > 1) {
            return {
                name: 'Default Max Is One',
                passed: false,
                error: `Expected max 1 concurrent holder, got ${maxConcurrent}`
            };
        }
        if (acquired.filter(Boolean).length !== 5) {
            return {
                name: 'Default Max Is One',
                passed: false,
                error: `Not all clients acquired lock: ${acquired.filter(Boolean).length}/5`
            };
        }
        log('Test 1 PASSED: Default max is 1');
        return { name: 'Default Max Is One', passed: true, details: { maxConcurrent } };
    }
    catch (err) {
        log('Test 1 FAILED', { error: err.message });
        return { name: 'Default Max Is One', passed: false, error: err.message };
    }
}
async function test2_SemaphoreMaxThree(broker, clients) {
    log('Test 2: Semaphore with max=3 should allow 3 concurrent holders');
    try {
        const key = 'test-semaphore-3';
        const MAX_HOLDERS = 3;
        let concurrentHolders = 0;
        let maxConcurrent = 0;
        let completedCount = 0;
        const promises = clients.slice(0, 10).map((client, index) => new Promise((resolve) => {
            client.lock(key, { max: MAX_HOLDERS }, (err, unlock) => {
                if (err) {
                    log(`Client ${index} failed:`, err.message);
                    return resolve();
                }
                concurrentHolders++;
                maxConcurrent = Math.max(maxConcurrent, concurrentHolders);
                if (concurrentHolders > MAX_HOLDERS) {
                    log(`⚠️  Too many concurrent holders: ${concurrentHolders} > ${MAX_HOLDERS}`);
                }
                log(`Client ${index} acquired (concurrent: ${concurrentHolders}, max: ${maxConcurrent})`);
                setTimeout(() => {
                    concurrentHolders--;
                    completedCount++;
                    unlock((unlockErr) => {
                        if (unlockErr)
                            log(`Client ${index} unlock error:`, unlockErr.message);
                        resolve();
                    });
                }, 50 + Math.random() * 100);
            });
        }));
        await Promise.all(promises);
        await delay(200);
        log('Test 2 results', { maxConcurrent, completedCount, expectedMax: MAX_HOLDERS });
        if (maxConcurrent > MAX_HOLDERS) {
            return {
                name: 'Semaphore Max Three',
                passed: false,
                error: `Max concurrent exceeded: ${maxConcurrent} > ${MAX_HOLDERS}`
            };
        }
        if (maxConcurrent < 2) {
            return {
                name: 'Semaphore Max Three',
                passed: false,
                error: `Expected at least 2 concurrent holders, got ${maxConcurrent}`
            };
        }
        if (completedCount !== 10) {
            return {
                name: 'Semaphore Max Three',
                passed: false,
                error: `Not all clients completed: ${completedCount}/10`
            };
        }
        log('Test 2 PASSED: Semaphore max=3 works correctly');
        return { name: 'Semaphore Max Three', passed: true, details: { maxConcurrent, completedCount } };
    }
    catch (err) {
        log('Test 2 FAILED', { error: err.message });
        return { name: 'Semaphore Max Three', passed: false, error: err.message };
    }
}
async function test3_SemaphoreMaxTen(broker, clients) {
    log('Test 3: Semaphore with max=10 should allow 10 concurrent holders');
    try {
        const key = 'test-semaphore-10';
        const MAX_HOLDERS = 10;
        let concurrentHolders = 0;
        let maxConcurrent = 0;
        let completedCount = 0;
        const promises = clients.slice(0, 20).map((client, index) => new Promise((resolve) => {
            client.lock(key, { max: MAX_HOLDERS }, (err, unlock) => {
                if (err) {
                    log(`Client ${index} failed:`, err.message);
                    return resolve();
                }
                concurrentHolders++;
                maxConcurrent = Math.max(maxConcurrent, concurrentHolders);
                log(`Client ${index} acquired (concurrent: ${concurrentHolders}, max: ${maxConcurrent})`);
                setTimeout(() => {
                    concurrentHolders--;
                    completedCount++;
                    unlock((unlockErr) => {
                        if (unlockErr)
                            log(`Client ${index} unlock error:`, unlockErr.message);
                        resolve();
                    });
                }, 30 + Math.random() * 70);
            });
        }));
        await Promise.all(promises);
        await delay(200);
        log('Test 3 results', { maxConcurrent, completedCount, expectedMax: MAX_HOLDERS });
        if (maxConcurrent > MAX_HOLDERS) {
            return {
                name: 'Semaphore Max Ten',
                passed: false,
                error: `Max concurrent exceeded: ${maxConcurrent} > ${MAX_HOLDERS}`
            };
        }
        if (maxConcurrent < 5) {
            return {
                name: 'Semaphore Max Ten',
                passed: false,
                error: `Expected at least 5 concurrent holders, got ${maxConcurrent}`
            };
        }
        if (completedCount !== 20) {
            return {
                name: 'Semaphore Max Ten',
                passed: false,
                error: `Not all clients completed: ${completedCount}/20`
            };
        }
        log('Test 3 PASSED: Semaphore max=10 works correctly');
        return { name: 'Semaphore Max Ten', passed: true, details: { maxConcurrent, completedCount } };
    }
    catch (err) {
        log('Test 3 FAILED', { error: err.message });
        return { name: 'Semaphore Max Ten', passed: false, error: err.message };
    }
}
async function runTests() {
    console.log('=== Standard Client Semaphore Test Suite ===\n');
    let broker = null;
    const clients = [];
    const results = [];
    try {
        log('Starting broker', { port: PORT });
        broker = new main_1.Broker1({ port: PORT });
        await broker.ensure();
        log('Creating clients', { count: 25 });
        for (let i = 0; i < 25; i++) {
            const client = new main_1.Client({ port: PORT, lockRequestTimeout: 30000 });
            await client.ensure();
            clients.push(client);
        }
        results.push(await test1_DefaultMaxIsOne(broker, clients));
        await delay(300);
        results.push(await test2_SemaphoreMaxThree(broker, clients));
        await delay(300);
        results.push(await test3_SemaphoreMaxTen(broker, clients));
        await delay(300);
        console.log('\n=== Test Summary ===');
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed);
        results.forEach(r => {
            const status = r.passed ? '✅' : '❌';
            console.log(`${status} ${r.name}`);
            if (!r.passed && r.error) {
                console.log(`   Error: ${r.error}`);
            }
        });
        console.log(`\nTotal: ${results.length} tests`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed.length}`);
        if (failed.length > 0) {
            throw new Error(`${failed.length} test(s) failed`);
        }
        console.log('\n✅ All tests passed!');
    }
    catch (err) {
        console.error('\n❌ Test suite failed:', err.message);
        throw err;
    }
    finally {
        log('Cleaning up...');
        for (const client of clients) {
            try {
                client.close();
            }
            catch (e) {
            }
        }
        if (broker) {
            await new Promise(resolve => broker.close(() => resolve()));
        }
    }
}
runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
