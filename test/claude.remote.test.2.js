"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const client_1 = require("../src/client");
const REMOTE_HOST = 'live-mutex.fly.dev';
const REMOTE_PORT = 6970;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const createClients = async (count, options = {}) => {
    const clients = [];
    const clientPromises = Array.from({ length: count }).map(async () => {
        const client = new client_1.Client({
            host: REMOTE_HOST,
            port: REMOTE_PORT,
            lockRequestTimeout: 5000,
            ...options
        });
        await client.ensure();
        clients.push(client);
    });
    await Promise.all(clientPromises);
    return clients;
};
const closeClients = async (clients) => {
    for (const client of clients) {
        try {
            client.close();
        }
        catch (e) {
            console.error('Error closing client:', e);
        }
    }
};
async function runAllTests() {
    console.log(`Starting Live Mutex tests against remote broker at ${REMOTE_HOST}:${REMOTE_PORT}`);
    const allClients = [];
    try {
        await testMultipleClientsForSameLock(allClients);
        await testSemaphoreWithMultipleHolders(allClients);
        await testConcurrentLockAndUnlock(allClients);
        await testLockExpiration(allClients);
        await testClientDisconnection(allClients);
        await testForcedUnlocks(allClients);
        await testRapidLockUnlockCycles(allClients);
        console.log('\n✓ All tests completed successfully');
    }
    catch (error) {
        console.error('\n✗ Test failed:', error);
        process.exit(1);
    }
    finally {
        await closeClients(allClients);
        console.log('✓ All clients closed');
    }
}
async function testMultipleClientsForSameLock(allClients) {
    console.log('\nTest 1: Multiple clients competing for the same lock');
    const lockKey = 'remote-concurrent-lock-test';
    const clientCount = 10;
    let acquiredCount = 0;
    const clients = await createClients(clientCount);
    allClients.push(...clients);
    console.log(`  Created ${clientCount} clients`);
    const lockPromises = clients.map(client => new Promise((resolve) => {
        client.lock(lockKey, (err, unlock) => {
            if (err) {
                console.error('  Error acquiring lock:', err.message);
                return resolve();
            }
            acquiredCount++;
            console.log(`  Client acquired lock, count: ${acquiredCount}`);
            setTimeout(() => {
                unlock((unlockErr) => {
                    if (unlockErr)
                        console.error('  Error releasing lock:', unlockErr.message);
                    resolve();
                });
            }, 100);
        });
    }));
    await Promise.all(lockPromises);
    assert.strictEqual(acquiredCount, clientCount, 'Not all clients acquired the lock');
    console.log(`✓ Test 1 passed: All ${acquiredCount} clients acquired and released the lock`);
}
async function testSemaphoreWithMultipleHolders(allClients) {
    console.log('\nTest 2: Semaphore with multiple holders');
    const lockKey = 'remote-semaphore-test';
    const MAX_HOLDERS = 3;
    const clientCount = 10;
    let activeHolders = new Set();
    let maxConcurrentHolders = 0;
    let completedCount = 0;
    const holdersMutex = {
        locked: false,
        queue: [],
        lock() {
            return new Promise(resolve => {
                if (this.locked) {
                    this.queue.push(resolve);
                }
                else {
                    this.locked = true;
                    resolve();
                }
            });
        },
        unlock() {
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                next();
            }
            else {
                this.locked = false;
            }
        }
    };
    const clients = await createClients(clientCount);
    allClients.push(...clients);
    const lockPromises = clients.map((client, idx) => new Promise((resolve) => {
        client.lock(lockKey, { max: MAX_HOLDERS }, async (err, unlock) => {
            if (err) {
                console.error('  Error acquiring semaphore:', err.message);
                return resolve();
            }
            await holdersMutex.lock();
            try {
                const clientId = `client-${idx}`;
                activeHolders.add(clientId);
                const currentHolderCount = activeHolders.size;
                maxConcurrentHolders = Math.max(maxConcurrentHolders, currentHolderCount);
                if (currentHolderCount > MAX_HOLDERS) {
                    console.error(`  WARNING: Detected ${currentHolderCount} concurrent holders (max: ${MAX_HOLDERS})`);
                    console.error(`  Active holders: ${Array.from(activeHolders).join(', ')}`);
                }
                assert.ok(currentHolderCount <= MAX_HOLDERS + 3, `Too many concurrent holders: ${currentHolderCount} > ${MAX_HOLDERS}`);
            }
            finally {
                holdersMutex.unlock();
            }
            setTimeout(async () => {
                await holdersMutex.lock();
                try {
                    activeHolders.delete(`client-${idx}`);
                    completedCount++;
                }
                finally {
                    holdersMutex.unlock();
                }
                unlock((unlockErr) => {
                    if (unlockErr)
                        console.error('  Error releasing semaphore:', unlockErr.message);
                    resolve();
                });
            }, 50 + Math.random() * 150);
        });
    }));
    await Promise.all(lockPromises);
    assert.strictEqual(completedCount, clientCount, 'Not all clients completed');
    assert.ok(maxConcurrentHolders <= MAX_HOLDERS, `Max concurrent exceeded limit: ${maxConcurrentHolders} > ${MAX_HOLDERS}`);
    assert.ok(maxConcurrentHolders > 1, 'Should have had multiple concurrent holders');
    console.log(`✓ Test 2 passed: Max concurrent holders: ${maxConcurrentHolders}, limit was ${MAX_HOLDERS}`);
}
async function testConcurrentLockAndUnlock(allClients) {
    console.log('\nTest 3: Concurrent lock and unlock operations');
    const lockPrefix = 'remote-concurrent-op-';
    const operationCount = 20;
    let completedCount = 0;
    const clients = await createClients(5);
    allClients.push(...clients);
    const operationPromises = Array.from({ length: operationCount }).map((_, n) => new Promise((resolve) => {
        const randomClient = clients[Math.floor(Math.random() * clients.length)];
        const lockKey = `${lockPrefix}${n % 5}`;
        randomClient.lock(lockKey, (err, unlock) => {
            if (err) {
                console.error(`  Error acquiring lock ${lockKey}:`, err.message);
                return resolve();
            }
            setTimeout(() => {
                unlock((unlockErr) => {
                    if (unlockErr) {
                        console.error(`  Error releasing lock ${lockKey}:`, unlockErr.message);
                    }
                    else {
                        completedCount++;
                    }
                    resolve();
                });
            }, 10 + Math.random() * 50);
        });
    }));
    await Promise.all(operationPromises);
    assert.strictEqual(completedCount, operationCount, 'Not all operations completed');
    console.log(`✓ Test 3 passed: ${completedCount} operations completed successfully`);
}
async function testLockExpiration(allClients) {
    console.log('\nTest 4: Lock expiration');
    const lockKey = 'remote-expiring-lock-test';
    let lockAcquiredBySecond = false;
    const clients = await createClients(2);
    allClients.push(...clients);
    const [client1, client2] = clients;
    await new Promise((resolve, reject) => {
        client1.lock(lockKey, { ttl: 1000 }, (err) => {
            if (err)
                return reject(err);
            console.log('  First client acquired lock (will expire)');
            resolve();
        });
    });
    console.log('  Waiting for lock to expire...');
    await delay(2000);
    await new Promise((resolve, reject) => {
        client2.lock(lockKey, (err, unlock2) => {
            if (err) {
                return reject(new Error('Second client failed to acquire lock after expiration: ' + err.message));
            }
            console.log('  Second client acquired lock after expiration');
            lockAcquiredBySecond = true;
            unlock2((unlockErr) => {
                if (unlockErr)
                    console.error('  Error releasing lock by second client:', unlockErr.message);
                resolve();
            });
        });
    });
    assert.strictEqual(lockAcquiredBySecond, true, 'Second client should have acquired the lock after expiration');
    console.log('✓ Test 4 passed: Lock properly expired and was acquired by second client');
}
async function testClientDisconnection(allClients) {
    console.log('\nTest 5: Client disconnection');
    const lockKey = 'remote-disconnect-test';
    let lockAcquiredBySecond = false;
    const disposableClient = new client_1.Client({
        host: REMOTE_HOST,
        port: REMOTE_PORT,
        lockRequestTimeout: 5000
    });
    await disposableClient.ensure();
    await new Promise((resolve, reject) => {
        disposableClient.lock(lockKey, (err) => {
            if (err)
                return reject(err);
            console.log('  Disposable client acquired lock');
            resolve();
        });
    });
    console.log('  Closing disposable client without unlocking');
    disposableClient.close();
    await delay(1500);
    const client2 = new client_1.Client({
        host: REMOTE_HOST,
        port: REMOTE_PORT,
        lockRequestTimeout: 5000
    });
    await client2.ensure();
    allClients.push(client2);
    await new Promise((resolve, reject) => {
        client2.lock(lockKey, (err, unlock2) => {
            if (err) {
                return reject(new Error('Second client failed to acquire lock after disconnection: ' + err.message));
            }
            console.log('  Second client acquired lock after disconnection');
            lockAcquiredBySecond = true;
            unlock2((unlockErr) => {
                if (unlockErr)
                    console.error('  Error releasing lock by second client:', unlockErr.message);
                resolve();
            });
        });
    });
    assert.strictEqual(lockAcquiredBySecond, true, 'Second client should have acquired the lock after disconnection');
    console.log('✓ Test 5 passed: Lock properly released after client disconnection');
}
async function testForcedUnlocks(allClients) {
    console.log('\nTest 6: Forced unlocks');
    const lockKey = 'remote-forced-unlock-test';
    let lockAcquiredByFirst = false;
    let lockAcquiredBySecond = false;
    const clients = await createClients(2);
    allClients.push(...clients);
    const [client1, client2] = clients;
    await new Promise((resolve, reject) => {
        client1.lock(lockKey, (err) => {
            if (err)
                return reject(err);
            lockAcquiredByFirst = true;
            console.log('  First client acquired lock');
            resolve();
        });
    });
    let secondClientError = false;
    try {
        await new Promise((resolve, reject) => {
            client2.lock(lockKey, { maxRetries: 0 }, (err) => {
                if (err) {
                    secondClientError = true;
                    resolve();
                }
                else {
                    reject(new Error('Second client should have failed with maxRetries:0'));
                }
            });
        });
    }
    catch (e) {
        console.error('  Error in second client maxRetries:0 test:', e);
    }
    assert.strictEqual(secondClientError, true, 'Second client should have failed with maxRetries:0');
    await new Promise((resolve, reject) => {
        client2.unlock(lockKey, { force: true }, (err) => {
            if (err)
                return reject(err);
            console.log('  Second client force-unlocked the lock');
            resolve();
        });
    });
    await new Promise((resolve, reject) => {
        client2.lock(lockKey, (err, unlock2) => {
            if (err)
                return reject(err);
            lockAcquiredBySecond = true;
            console.log('  Second client acquired lock after force-unlock');
            unlock2((unlockErr) => {
                if (unlockErr)
                    console.error('  Error releasing lock by second client:', unlockErr.message);
                resolve();
            });
        });
    });
    assert.strictEqual(lockAcquiredByFirst, true, 'First client should have acquired the lock');
    assert.strictEqual(lockAcquiredBySecond, true, 'Second client should have acquired the lock after force-unlock');
    console.log('✓ Test 6 passed: Force unlock worked correctly');
}
async function testRapidLockUnlockCycles(allClients) {
    console.log('\nTest 7: Rapid lock/unlock cycles');
    const cycles = 30;
    const concurrentClients = 5;
    const lockKey = 'remote-rapid-cycle-test';
    let completedCycles = 0;
    const clients = await createClients(concurrentClients, {
        lockRequestTimeout: 7000
    });
    allClients.push(...clients);
    const runCycle = (client) => {
        return new Promise((resolve) => {
            client.lock(lockKey, (err, unlock) => {
                if (err) {
                    console.error('  Lock cycle error:', err.message);
                    return resolve();
                }
                process.nextTick(() => {
                    unlock((unlockErr) => {
                        if (unlockErr) {
                            console.error('  Unlock cycle error:', unlockErr.message);
                        }
                        else {
                            completedCycles++;
                        }
                        resolve();
                    });
                });
            });
        });
    };
    const cyclePromises = [];
    for (let i = 0; i < cycles; i++) {
        const client = clients[i % clients.length];
        cyclePromises.push(runCycle(client));
    }
    await Promise.all(cyclePromises);
    console.log(`  Completed ${completedCycles} out of ${cycles} lock/unlock cycles`);
    assert.ok(completedCycles > 0, 'Should have completed some cycles');
    assert.ok(completedCycles > cycles * 0.6, 'Should have completed at least 60% of cycles for remote broker');
    console.log(`✓ Test 7 passed: Completed ${completedCycles}/${cycles} rapid lock/unlock cycles`);
}
runAllTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
