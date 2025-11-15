"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const broker_1_1 = require("../src/broker-1");
const client_1 = require("../src/client");
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const createClients = async (count, port, options = {}) => {
    const clients = [];
    const clientPromises = Array.from({ length: count }).map(async () => {
        const client = new client_1.Client({
            port,
            lockRequestTimeout: 3000,
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
    console.log('Starting Live Mutex broker concurrency tests');
    const port = 7777;
    const allClients = [];
    let broker;
    try {
        broker = new broker_1_1.Broker1({
            port: port,
            lockExpiresAfter: 1000,
            timeoutToFindNewLockholder: 800
        });
        await broker.ensure();
        console.log('✓ Broker started on port', port);
        await testMultipleClientsForSameLock(port, allClients);
        await testSemaphoreWithMultipleHolders(port, allClients);
        await testConcurrentLockAndUnlock(port, allClients);
        await testLockExpiration(port, allClients);
        await testClientDisconnection(port, allClients);
        await testForcedUnlocks(port, allClients);
        await testRapidLockUnlockCycles(port, allClients);
        console.log('\n✓ All tests completed successfully');
    }
    catch (error) {
        console.error('\n✗ Test failed:', error);
        process.exit(1);
    }
    finally {
        await closeClients(allClients);
        if (broker) {
            await new Promise((resolve, reject) => {
                broker.close((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            console.log('✓ Broker closed');
        }
    }
}
async function testMultipleClientsForSameLock(port, allClients) {
    console.log('\nTest 1: Multiple clients competing for the same lock');
    const lockKey = 'concurrent-lock-test';
    const clientCount = 10;
    let acquiredCount = 0;
    const clients = await createClients(clientCount, port);
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
async function testSemaphoreWithMultipleHolders(port, allClients) {
    console.log('\nTest 2: Semaphore with multiple holders');
    const lockKey = 'semaphore-test';
    const MAX_HOLDERS = 3;
    const clientCount = 10;
    let concurrentHolders = 0;
    let maxConcurrentHolders = 0;
    let completedCount = 0;
    const clients = await createClients(clientCount, port);
    allClients.push(...clients);
    const lockPromises = clients.map(client => new Promise((resolve) => {
        client.lock(lockKey, { max: MAX_HOLDERS }, (err, unlock) => {
            if (err) {
                console.error('  Error acquiring semaphore:', err.message);
                return resolve();
            }
            concurrentHolders++;
            maxConcurrentHolders = Math.max(maxConcurrentHolders, concurrentHolders);
            assert.ok(concurrentHolders <= MAX_HOLDERS, `Too many concurrent holders: ${concurrentHolders} > ${MAX_HOLDERS}`);
            setTimeout(() => {
                concurrentHolders--;
                completedCount++;
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
async function testConcurrentLockAndUnlock(port, allClients) {
    console.log('\nTest 3: Concurrent lock and unlock operations');
    const lockPrefix = 'concurrent-op-';
    const operationCount = 20;
    let completedCount = 0;
    const clients = await createClients(5, port);
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
async function testLockExpiration(port, allClients) {
    console.log('\nTest 4: Lock expiration');
    const lockKey = 'expiring-lock-test';
    let lockAcquiredBySecond = false;
    const clients = await createClients(2, port);
    allClients.push(...clients);
    const [client1, client2] = clients;
    await new Promise((resolve, reject) => {
        client1.lock(lockKey, { ttl: 500 }, (err) => {
            if (err)
                return reject(err);
            console.log('  First client acquired lock (will expire)');
            resolve();
        });
    });
    console.log('  Waiting for lock to expire...');
    await delay(1000);
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
async function testClientDisconnection(port, allClients) {
    console.log('\nTest 5: Client disconnection');
    const lockKey = 'disconnect-test';
    let lockAcquiredBySecond = false;
    const disposableClient = new client_1.Client({
        port: port,
        lockRequestTimeout: 2000
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
    await delay(500);
    const client2 = new client_1.Client({
        port: port,
        lockRequestTimeout: 2000
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
async function testForcedUnlocks(port, allClients) {
    console.log('\nTest 6: Forced unlocks');
    const lockKey = 'forced-unlock-test';
    let lockAcquiredByFirst = false;
    let lockAcquiredBySecond = false;
    const clients = await createClients(2, port);
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
                    reject(new Error('Second client should have failed with wait:false'));
                }
            });
        });
    }
    catch (e) {
        console.error('  Error in second client wait:false test:', e);
    }
    assert.strictEqual(secondClientError, true, 'Second client should have failed with wait:false');
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
async function testRapidLockUnlockCycles(port, allClients) {
    console.log('\nTest 7: Rapid lock/unlock cycles');
    const cycles = 50;
    const concurrentClients = 5;
    const lockKey = 'rapid-cycle-test';
    let completedCycles = 0;
    const clients = await createClients(concurrentClients, port, {
        lockRequestTimeout: 5000
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
    assert.ok(completedCycles > cycles * 0.7, 'Should have completed at least 70% of cycles');
    console.log(`✓ Test 7 passed: Completed ${completedCycles}/${cycles} rapid lock/unlock cycles`);
}
runAllTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
