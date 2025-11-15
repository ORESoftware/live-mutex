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
        client.emitter.on('warning', v => {
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
    console.log(`Starting Enhanced Live Mutex tests against remote broker at ${REMOTE_HOST}:${REMOTE_PORT}`);
    const allClients = [];
    try {
        await testMultipleClientsForSameLock(allClients);
        await testSemaphoreWithMultipleHolders(allClients);
        await testConcurrentLockAndUnlock(allClients);
        await testLockExpiration(allClients);
        await testClientDisconnection(allClients);
        await testForcedUnlocks(allClients);
        await testRapidLockUnlockCycles(allClients);
        await testPromiseBasedAPI(allClients);
        await testCascadingLocks(allClients);
        await testLockContentionWithBackpressure(allClients);
        await testTTLVariations(allClients);
        await testSystemStabilityUnderLoad(allClients);
        await testLockReacquisition(allClients);
        await testStaggeredClientConnections(allClients);
        await testPingConnectivity(allClients);
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
    const clientCount = 15;
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
            }, 50 + Math.random() * 150);
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
    const clientCount = 15;
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
                assert.ok(currentHolderCount <= MAX_HOLDERS, `Too many concurrent holders: ${currentHolderCount} > ${MAX_HOLDERS}`);
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
            }, 50 + Math.random() * 200);
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
    const operationCount = 50;
    let completedCount = 0;
    const clients = await createClients(10);
    allClients.push(...clients);
    const operationPromises = Array.from({ length: operationCount }).map((_, n) => new Promise((resolve) => {
        const randomClient = clients[Math.floor(Math.random() * clients.length)];
        const lockKey = `${lockPrefix}${n % 10}`;
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
    const cycles = 100;
    const concurrentClients = 10;
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
async function testPromiseBasedAPI(allClients) {
    console.log('\nTest 8: Promise-based API for lock/unlock');
    const lockKey = 'remote-promise-api-test';
    const clientCount = 5;
    let successCount = 0;
    const clients = await createClients(clientCount);
    allClients.push(...clients);
    for (const client of clients) {
        try {
            const lock = await client.acquireLock(lockKey);
            console.log('  Client acquired lock via promise API');
            await delay(50);
            await client.releaseLock(lockKey, { _uuid: lock.lockUuid });
            console.log('  Client released lock via promise API');
            successCount++;
        }
        catch (err) {
            console.error('  Promise API error:', err);
        }
    }
    assert.strictEqual(successCount, clientCount, 'All clients should successfully use promise API');
    console.log(`✓ Test 8 passed: All ${successCount} clients successfully used promise-based API`);
}
async function testCascadingLocks(allClients) {
    console.log('\nTest 9: Cascading locks (acquiring multiple locks in sequence)');
    const lockKeys = ['resource-A', 'resource-B', 'resource-C', 'resource-D'];
    const clientCount = 3;
    let successCount = 0;
    const clients = await createClients(clientCount);
    allClients.push(...clients);
    const lockPromises = clients.map((client, clientIndex) => new Promise(async (resolve) => {
        const lockHandles = [];
        let locked = true;
        try {
            for (const key of lockKeys) {
                const fullKey = `remote-cascading-${key}`;
                await new Promise((resolveLock, rejectLock) => {
                    client.lock(fullKey, (err, unlock) => {
                        if (err) {
                            locked = false;
                            console.error(`  Client ${clientIndex} failed to acquire lock ${fullKey}:`, err.message);
                            return rejectLock(err);
                        }
                        console.log(`  Client ${clientIndex} acquired lock ${fullKey}`);
                        lockHandles.push({ key: fullKey, unlock });
                        resolveLock();
                    });
                });
                await delay(20);
            }
            await delay(100);
            while (lockHandles.length > 0) {
                const handle = lockHandles.pop();
                await new Promise((resolveUnlock) => {
                    handle.unlock((err) => {
                        if (err) {
                            console.error(`  Client ${clientIndex} error releasing ${handle.key}:`, err.message);
                        }
                        else {
                            console.log(`  Client ${clientIndex} released lock ${handle.key}`);
                        }
                        resolveUnlock();
                    });
                });
            }
            if (locked) {
                successCount++;
            }
        }
        catch (err) {
            console.error(`  Client ${clientIndex} error in cascading locks:`, err);
            while (lockHandles.length > 0) {
                const handle = lockHandles.pop();
                try {
                    await new Promise((resolveUnlock) => {
                        handle.unlock((err) => resolveUnlock());
                    });
                }
                catch (unlockErr) {
                }
            }
        }
        resolve();
    }));
    await Promise.all(lockPromises);
    assert.ok(successCount > 0, 'At least one client should succeed with cascading locks');
    console.log(`✓ Test 9 passed: ${successCount}/${clientCount} clients successfully acquired cascading locks`);
}
async function testLockContentionWithBackpressure(allClients) {
    console.log('\nTest 10: Lock contention with backpressure');
    const lockKey = 'remote-contention-test';
    const clientCount = 20;
    const holdDuration = 200;
    let successCount = 0;
    let maxQueuedRequests = 0;
    const clients = await createClients(clientCount);
    allClients.push(...clients);
    const monitorClient = clients[0];
    const checkQueueSize = async () => {
        return new Promise((resolve, reject) => {
            monitorClient.requestLockInfo(lockKey, (err, info) => {
                if (err)
                    return resolve(0);
                const queueSize = info?.data?.lockRequestCount || 0;
                maxQueuedRequests = Math.max(maxQueuedRequests, queueSize);
                resolve(queueSize);
            });
        });
    };
    const contentionPromises = clients.map((client, idx) => new Promise(async (resolve) => {
        const startTime = Date.now();
        try {
            await new Promise((resolveLock, rejectLock) => {
                client.lock(lockKey, (err, unlock) => {
                    if (err) {
                        console.error(`  Client ${idx} failed to acquire lock:`, err.message);
                        return resolveLock();
                    }
                    const acquireTime = Date.now() - startTime;
                    console.log(`  Client ${idx} acquired lock after ${acquireTime}ms`);
                    setTimeout(() => {
                        unlock((unlockErr) => {
                            if (unlockErr) {
                                console.error(`  Client ${idx} error releasing lock:`, unlockErr.message);
                            }
                            else {
                                successCount++;
                            }
                            resolveLock();
                        });
                    }, holdDuration);
                });
            });
        }
        catch (err) {
            console.error(`  Client ${idx} error in contention test:`, err);
        }
        resolve();
    }));
    const monitorPromise = (async () => {
        for (let i = 0; i < 10; i++) {
            await delay(200);
            const queueSize = await checkQueueSize();
            console.log(`  Current lock request queue size: ${queueSize}`);
        }
    })();
    await Promise.all([...contentionPromises, monitorPromise]);
    console.log(`  Max queued lock requests: ${maxQueuedRequests}`);
    assert.ok(successCount > 0, 'Some clients should successfully acquire and release the lock');
    assert.ok(maxQueuedRequests > 0, 'Should have observed queued lock requests');
    console.log(`✓ Test 10 passed: ${successCount}/${clientCount} clients succeeded with max queue size of ${maxQueuedRequests}`);
}
async function testTTLVariations(allClients) {
    console.log('\nTest 11: TTL variations');
    const lockKeyPrefix = 'remote-ttl-test-';
    const ttlValues = [500, 1000, 2000, 5000];
    const results = [];
    const clients = await createClients(ttlValues.length * 2);
    allClients.push(...clients);
    const ttlPromises = ttlValues.map((ttl, idx) => new Promise(async (resolve) => {
        const lockKey = `${lockKeyPrefix}${ttl}`;
        const client1 = clients[idx * 2];
        const client2 = clients[idx * 2 + 1];
        try {
            await new Promise((resolveLock, rejectLock) => {
                client1.lock(lockKey, { ttl }, (err) => {
                    if (err)
                        return rejectLock(err);
                    console.log(`  Client acquired lock with TTL ${ttl}ms`);
                    resolveLock();
                });
            });
            await delay(ttl * 0.75);
            let earlyAcquisitionFailed = false;
            try {
                await new Promise((resolveLock, rejectLock) => {
                    client2.lock(lockKey, { maxRetries: 0 }, (err) => {
                        if (err) {
                            earlyAcquisitionFailed = true;
                            resolveLock();
                        }
                        else {
                            rejectLock(new Error(`Lock was acquired before TTL expired (${ttl}ms)`));
                        }
                    });
                });
            }
            catch (err) {
                console.error(`  Error testing TTL ${ttl}ms:`, err);
            }
            assert.strictEqual(earlyAcquisitionFailed, true, `Lock should not be acquirable before TTL expires (${ttl}ms)`);
            await delay(ttl * 0.3 + 500);
            let lockAcquiredAfterTTL = false;
            try {
                await new Promise((resolveLock, rejectLock) => {
                    client2.lock(lockKey, (err, unlock) => {
                        if (err) {
                            return rejectLock(new Error(`Failed to acquire lock after TTL expired (${ttl}ms): ${err.message}`));
                        }
                        lockAcquiredAfterTTL = true;
                        console.log(`  Lock acquired after TTL ${ttl}ms expired`);
                        unlock((unlockErr) => {
                            if (unlockErr)
                                console.error(`  Error releasing lock with TTL ${ttl}ms:`, unlockErr.message);
                            resolveLock();
                        });
                    });
                });
            }
            catch (err) {
                console.error(`  Error testing TTL ${ttl}ms expiration:`, err);
            }
            results.push({ ttl, expired: lockAcquiredAfterTTL });
        }
        catch (err) {
            console.error(`  Error in TTL test for ${ttl}ms:`, err);
            results.push({ ttl, expired: false });
        }
        resolve();
    }));
    await Promise.all(ttlPromises);
    const allExpired = results.every(r => r.expired);
    assert.strictEqual(allExpired, true, 'All locks should have expired after their TTL');
    console.log(`✓ Test 11 passed: All ${results.length} TTL variations correctly expired`);
}
async function testSystemStabilityUnderLoad(allClients) {
    console.log('\nTest 12: System stability under load');
    const lockCount = 20;
    const clientCount = 15;
    const operationsPerClient = 50;
    let completedOperations = 0;
    let errors = 0;
    const clients = await createClients(clientCount);
    allClients.push(...clients);
    const lockKeys = Array.from({ length: lockCount }, (_, i) => `remote-stability-test-${i}`);
    const clientPromises = clients.map((client, clientIndex) => new Promise(async (resolve) => {
        for (let i = 0; i < operationsPerClient; i++) {
            try {
                const lockKey = lockKeys[Math.floor(Math.random() * lockKeys.length)];
                await new Promise((resolveOp, rejectOp) => {
                    setTimeout(() => {
                        client.lock(lockKey, (err, unlock) => {
                            if (err) {
                                errors++;
                                return resolveOp();
                            }
                            setTimeout(() => {
                                unlock((unlockErr) => {
                                    if (unlockErr) {
                                        errors++;
                                    }
                                    else {
                                        completedOperations++;
                                    }
                                    resolveOp();
                                });
                            }, 5 + Math.random() * 20);
                        });
                    }, Math.random() * 50);
                });
                if (i % 20 === 0) {
                    try {
                        await client.getSystemStats();
                    }
                    catch (err) {
                    }
                }
            }
            catch (err) {
                errors++;
                console.error(`  Client ${clientIndex} error:`, err);
            }
            if ((clientIndex * operationsPerClient + i) % 100 === 0) {
                console.log(`  Completed ${completedOperations} operations with ${errors} errors`);
            }
        }
        resolve();
    }));
    await Promise.all(clientPromises);
    const totalOperations = clientCount * operationsPerClient;
    const successRate = (completedOperations / totalOperations) * 100;
    console.log(`  Completed ${completedOperations}/${totalOperations} operations (${successRate.toFixed(2)}%) with ${errors} errors`);
    assert.ok(successRate > 80, `Success rate should be above 80%, got ${successRate.toFixed(2)}%`);
    console.log(`✓ Test 12 passed: System remained stable under load with ${successRate.toFixed(2)}% success rate`);
}
async function testLockReacquisition(allClients) {
    console.log('\nTest 13: Lock reacquisition');
    const lockKey = 'remote-reacquisition-test';
    const reacquisitions = 10;
    let successCount = 0;
    const clients = await createClients(1);
    allClients.push(...clients);
    const client = clients[0];
    for (let i = 0; i < reacquisitions; i++) {
        try {
            const lock = await client.acquireLock(lockKey);
            console.log(`  Acquired lock iteration ${i + 1}`);
            await delay(50);
            await client.releaseLock(lockKey, { _uuid: lock.lockUuid });
            console.log(`  Released lock iteration ${i + 1}`);
            successCount++;
        }
        catch (err) {
            console.error(`  Error in reacquisition test iteration ${i + 1}:`, err);
        }
    }
    assert.strictEqual(successCount, reacquisitions, `Should have successfully reacquired the lock ${reacquisitions} times`);
    console.log(`✓ Test 13 passed: Successfully reacquired the same lock ${successCount} times`);
}
async function testStaggeredClientConnections(allClients) {
    console.log('\nTest 14: Staggered client connections and disconnections');
    const lockKey = 'remote-staggered-test';
    const totalClients = 10;
    let operationsCompleted = 0;
    const initialClient = new client_1.Client({
        host: REMOTE_HOST,
        port: REMOTE_PORT
    });
    await initialClient.ensure();
    allClients.push(initialClient);
    const runTest = async () => {
        const activeClients = [initialClient];
        const operationQueue = [];
        operationQueue.push(new Promise(async (resolve) => {
            try {
                const lock = await initialClient.acquireLock(lockKey);
                console.log('  Initial client acquired lock');
                await delay(100);
                await initialClient.releaseLock(lockKey, { _uuid: lock.lockUuid });
                console.log('  Initial client released lock');
                operationsCompleted++;
            }
            catch (err) {
                console.error('  Initial operation error:', err);
            }
            resolve();
        }));
        for (let i = 1; i < totalClients; i++) {
            const newClient = new client_1.Client({
                host: REMOTE_HOST,
                port: REMOTE_PORT
            });
            await newClient.ensure();
            activeClients.push(newClient);
            allClients.push(newClient);
            console.log(`  Added client ${i + 1}`);
            operationQueue.push(new Promise(async (resolve) => {
                try {
                    const lock = await newClient.acquireLock(lockKey);
                    console.log(`  Client ${i + 1} acquired lock`);
                    await delay(50 + Math.random() * 100);
                    await newClient.releaseLock(lockKey, { _uuid: lock.lockUuid });
                    console.log(`  Client ${i + 1} released lock`);
                    operationsCompleted++;
                }
                catch (err) {
                    console.error(`  Client ${i + 1} operation error:`, err);
                }
                resolve();
            }));
            if (i > 2 && i % 3 === 0) {
                const disconnectIndex = Math.floor(Math.random() * (activeClients.length - 1));
                const clientToDisconnect = activeClients[disconnectIndex];
                activeClients.splice(disconnectIndex, 1);
                console.log(`  Disconnecting a client (index ${disconnectIndex})`);
                clientToDisconnect.close();
            }
            await delay(100);
        }
        await Promise.all(operationQueue);
    };
    await runTest();
    console.log(`  Completed ${operationsCompleted} operations with staggered clients`);
    assert.ok(operationsCompleted > 0, 'Some operations should have completed successfully');
    console.log(`✓ Test 14 passed: Successfully managed staggered client connections and disconnections`);
}
async function testPingConnectivity(allClients) {
    console.log('\nTest 15: Ping/connectivity tests');
    const clients = await createClients(1);
    allClients.push(...clients);
    const client = clients[0];
    const pingResults = [];
    const pingCount = 10;
    for (let i = 0; i < pingCount; i++) {
        try {
            const result = await client.ping();
            pingResults.push(result.roundTripTime);
            console.log(`  Ping ${i + 1}: ${result.roundTripTime}ms round trip time`);
            await delay(50);
        }
        catch (err) {
            console.error(`  Ping ${i + 1} error:`, err);
        }
    }
    try {
        const stats = await client.getSystemStats();
        console.log(`  System stats: ${stats.broker.connectedClients} connected clients`);
    }
    catch (err) {
        console.error('  System stats error:', err);
    }
    assert.ok(pingResults.length > 0, 'Should have received ping responses');
    const avgPing = pingResults.reduce((sum, time) => sum + time, 0) / pingResults.length;
    console.log(`  Average ping round trip time: ${avgPing.toFixed(2)}ms`);
    console.log(`✓ Test 15 passed: Successfully completed ping connectivity tests`);
}
runAllTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
