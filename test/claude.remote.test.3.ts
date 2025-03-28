import * as assert from 'assert';
import { Client } from '../src/client';

/**
 * Enhanced test script for Live Mutex broker with comprehensive test scenarios
 * Tests various race conditions, concurrency scenarios, and edge cases using promises
 * Remote broker at: live-mutex.fly.dev on port 6970
 */

// Constants for remote connection
const REMOTE_HOST = 'live-mutex.fly.dev';
const REMOTE_PORT = 6970;

// Helper function to create a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to create multiple clients
const createClients = async (count: number, options = {}): Promise<Client[]> => {
    const clients: Client[] = [];
    const clientPromises = Array.from({ length: count }).map(async () => {
        const client = new Client({
            host: REMOTE_HOST,
            port: REMOTE_PORT,
            lockRequestTimeout: 5000, // Longer timeout for remote connections
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

// Helper to close clients
const closeClients = async (clients: Client[]): Promise<void> => {
    for (const client of clients) {
        try {
            client.close();
        } catch (e) {
            console.error('Error closing client:', e);
        }
    }
};

// Run all tests sequentially
async function runAllTests() {
    console.log(`Starting Enhanced Live Mutex tests against remote broker at ${REMOTE_HOST}:${REMOTE_PORT}`);
    const allClients: Client[] = [];

    try {
        // Test 1: Multiple clients competing for the same lock
        await testMultipleClientsForSameLock(allClients);

        // Test 2: Semaphore with multiple holders
        await testSemaphoreWithMultipleHolders(allClients);

        // Test 3: Concurrent lock and unlock operations
        await testConcurrentLockAndUnlock(allClients);

        // Test 4: Lock expiration
        await testLockExpiration(allClients);

        // Test 5: Client disconnection
        await testClientDisconnection(allClients);

        // Test 6: Forced unlocks
        await testForcedUnlocks(allClients);

        // Test 7: Rapid lock/unlock cycles
        await testRapidLockUnlockCycles(allClients);

        // Test 8: Promise-based API for lock/unlock
        await testPromiseBasedAPI(allClients);

        // Test 9: Cascading locks (lock multiple resources in sequence)
        await testCascadingLocks(allClients);

        // Test 10: Lock contention with backpressure
        await testLockContentionWithBackpressure(allClients);

        // Test 11: TTL variations
        await testTTLVariations(allClients);

        // Test 12: System stability under load
        await testSystemStabilityUnderLoad(allClients);

        // Test 13: Lock reacquisition
        await testLockReacquisition(allClients);

        // Test 14: Staggered client connections and disconnections
        await testStaggeredClientConnections(allClients);

        // Test 15: Ping/connectivity tests
        await testPingConnectivity(allClients);

        console.log('\n✓ All tests completed successfully');
    } catch (error) {
        console.error('\n✗ Test failed:', error);
        process.exit(1);
    } finally {
        // Clean up
        await closeClients(allClients);
        console.log('✓ All clients closed');
    }
}

// Test 1: Multiple clients trying to acquire the same lock
async function testMultipleClientsForSameLock(allClients: Client[]) {
    console.log('\nTest 1: Multiple clients competing for the same lock');

    const lockKey = 'remote-concurrent-lock-test';
    const clientCount = 15; // Increased from 10
    let acquiredCount = 0;

    // Create multiple clients
    const clients = await createClients(clientCount);
    allClients.push(...clients);
    console.log(`  Created ${clientCount} clients`);

    // Have all clients try to acquire the same lock simultaneously
    const lockPromises = clients.map(client =>
        new Promise<void>((resolve) => {
            client.lock(lockKey, (err, unlock) => {
                if (err) {
                    console.error('  Error acquiring lock:', err.message);
                    return resolve();
                }

                acquiredCount++;
                console.log(`  Client acquired lock, count: ${acquiredCount}`);

                // Simulate some work with varying durations
                setTimeout(() => {
                    unlock((unlockErr) => {
                        if (unlockErr) console.error('  Error releasing lock:', unlockErr.message);
                        resolve();
                    });
                }, 50 + Math.random() * 150);
            });
        })
    );

    await Promise.all(lockPromises);

    // Verify results
    assert.strictEqual(acquiredCount, clientCount, 'Not all clients acquired the lock');
    console.log(`✓ Test 1 passed: All ${acquiredCount} clients acquired and released the lock`);
}

// Test 2: Semaphore with multiple holders
async function testSemaphoreWithMultipleHolders(allClients: Client[]) {
    console.log('\nTest 2: Semaphore with multiple holders');

    const lockKey = 'remote-semaphore-test';
    const MAX_HOLDERS = 3;  // Allow 3 concurrent holders
    const clientCount = 15; // Increased from 10

    // Use a synchronization mechanism to track concurrent holders
    let activeHolders = new Set();
    let maxConcurrentHolders = 0;
    let completedCount = 0;

    // Mutex for updating the activeHolders set to avoid race conditions
    const holdersMutex = {
        locked: false,
        queue: [] as Function[],

        lock(): Promise<void> {
            return new Promise(resolve => {
                if (this.locked) {
                    this.queue.push(resolve);
                } else {
                    this.locked = true;
                    resolve();
                }
            });
        },

        unlock(): void {
            if (this.queue.length > 0) {
                const next = this.queue.shift()!;
                next();
            } else {
                this.locked = false;
            }
        }
    };

    // Create multiple clients
    const clients = await createClients(clientCount);
    allClients.push(...clients);

    // Have all clients try to acquire the same semaphore lock simultaneously
    const lockPromises = clients.map((client, idx) =>
        new Promise<void>((resolve) => {
            client.lock(lockKey, {max: MAX_HOLDERS}, async (err, unlock) => {
                if (err) {
                    console.error('  Error acquiring semaphore:', err.message);
                    return resolve();
                }

                // Track concurrent holders with synchronization
                await holdersMutex.lock();
                try {
                    const clientId = `client-${idx}`;
                    activeHolders.add(clientId);

                    const currentHolderCount = activeHolders.size;
                    maxConcurrentHolders = Math.max(maxConcurrentHolders, currentHolderCount);

                    // Log when we observe more than MAX_HOLDERS (should never happen)
                    if (currentHolderCount > MAX_HOLDERS) {
                        console.error(`  WARNING: Detected ${currentHolderCount} concurrent holders (max: ${MAX_HOLDERS})`);
                        console.error(`  Active holders: ${Array.from(activeHolders).join(', ')}`);
                    }

                    // Verify we don't exceed the semaphore limit
                    assert.ok(currentHolderCount <= MAX_HOLDERS,
                        `Too many concurrent holders: ${currentHolderCount} > ${MAX_HOLDERS}`);
                } finally {
                    holdersMutex.unlock();
                }

                // Simulate some work with random duration
                setTimeout(async () => {
                    await holdersMutex.lock();
                    try {
                        activeHolders.delete(`client-${idx}`);
                        completedCount++;
                    } finally {
                        holdersMutex.unlock();
                    }

                    unlock((unlockErr) => {
                        if (unlockErr) console.error('  Error releasing semaphore:', unlockErr.message);
                        resolve();
                    });
                }, 50 + Math.random() * 200);
            });
        })
    );

    await Promise.all(lockPromises);

    // Verify results
    assert.strictEqual(completedCount, clientCount, 'Not all clients completed');
    assert.ok(maxConcurrentHolders <= MAX_HOLDERS,
        `Max concurrent exceeded limit: ${maxConcurrentHolders} > ${MAX_HOLDERS}`);
    assert.ok(maxConcurrentHolders > 1, 'Should have had multiple concurrent holders');

    console.log(`✓ Test 2 passed: Max concurrent holders: ${maxConcurrentHolders}, limit was ${MAX_HOLDERS}`);
}

// Test 3: Concurrent lock and unlock operations
async function testConcurrentLockAndUnlock(allClients: Client[]) {
    console.log('\nTest 3: Concurrent lock and unlock operations');

    const lockPrefix = 'remote-concurrent-op-';
    const operationCount = 50; // Increased from 20
    let completedCount = 0;

    // Create clients
    const clients = await createClients(10); // Increased from 5
    allClients.push(...clients);

    // Create operation promises
    const operationPromises = Array.from({ length: operationCount }).map((_, n) =>
        new Promise<void>((resolve) => {
            const randomClient = clients[Math.floor(Math.random() * clients.length)];
            const lockKey = `${lockPrefix}${n % 10}`; // Use 10 different lock keys

            randomClient.lock(lockKey, (err, unlock) => {
                if (err) {
                    console.error(`  Error acquiring lock ${lockKey}:`, err.message);
                    return resolve();
                }

                // Brief simulated work
                setTimeout(() => {
                    unlock((unlockErr) => {
                        if (unlockErr) {
                            console.error(`  Error releasing lock ${lockKey}:`, unlockErr.message);
                        } else {
                            completedCount++;
                        }
                        resolve();
                    });
                }, 10 + Math.random() * 50);
            });
        })
    );

    await Promise.all(operationPromises);

    // Verify results
    assert.strictEqual(completedCount, operationCount, 'Not all operations completed');
    console.log(`✓ Test 3 passed: ${completedCount} operations completed successfully`);
}

// Test 4: Lock expiration
async function testLockExpiration(allClients: Client[]) {
    console.log('\nTest 4: Lock expiration');

    const lockKey = 'remote-expiring-lock-test';
    let lockAcquiredBySecond = false;

    // Create two clients
    const clients = await createClients(2);
    allClients.push(...clients);
    const [client1, client2] = clients;

    // First client acquires lock but never releases it
    await new Promise<void>((resolve, reject) => {
        client1.lock(lockKey, {ttl: 1000}, (err) => { // 1 second TTL
            if (err) return reject(err);
            console.log('  First client acquired lock (will expire)');
            resolve();
        });
    });

    // Wait for lock to expire
    console.log('  Waiting for lock to expire...');
    await delay(2000); // Wait 2 seconds

    // Second client tries to acquire after expiration
    await new Promise<void>((resolve, reject) => {
        client2.lock(lockKey, (err, unlock2) => {
            if (err) {
                return reject(new Error('Second client failed to acquire lock after expiration: ' + err.message));
            }

            console.log('  Second client acquired lock after expiration');
            lockAcquiredBySecond = true;

            unlock2((unlockErr) => {
                if (unlockErr) console.error('  Error releasing lock by second client:', unlockErr.message);
                resolve();
            });
        });
    });

    // Verify results
    assert.strictEqual(lockAcquiredBySecond, true, 'Second client should have acquired the lock after expiration');
    console.log('✓ Test 4 passed: Lock properly expired and was acquired by second client');
}

// Test 5: Client disconnection
async function testClientDisconnection(allClients: Client[]) {
    console.log('\nTest 5: Client disconnection');

    const lockKey = 'remote-disconnect-test';
    let lockAcquiredBySecond = false;

    // Create a disposable client
    const disposableClient = new Client({
        host: REMOTE_HOST,
        port: REMOTE_PORT,
        lockRequestTimeout: 5000
    });

    await disposableClient.ensure();

    // First client acquires lock
    await new Promise<void>((resolve, reject) => {
        disposableClient.lock(lockKey, (err) => {
            if (err) return reject(err);
            console.log('  Disposable client acquired lock');
            resolve();
        });
    });

    // Abruptly close the client without unlocking
    console.log('  Closing disposable client without unlocking');
    disposableClient.close();

    // Wait for broker to detect disconnection
    await delay(1500); // 1.5 seconds wait for remote broker detection

    // Create another client
    const client2 = new Client({
        host: REMOTE_HOST,
        port: REMOTE_PORT,
        lockRequestTimeout: 5000
    });

    await client2.ensure();
    allClients.push(client2);

    // Second client tries to acquire the same lock
    await new Promise<void>((resolve, reject) => {
        client2.lock(lockKey, (err, unlock2) => {
            if (err) {
                return reject(new Error('Second client failed to acquire lock after disconnection: ' + err.message));
            }

            console.log('  Second client acquired lock after disconnection');
            lockAcquiredBySecond = true;

            unlock2((unlockErr) => {
                if (unlockErr) console.error('  Error releasing lock by second client:', unlockErr.message);
                resolve();
            });
        });
    });

    // Verify results
    assert.strictEqual(lockAcquiredBySecond, true, 'Second client should have acquired the lock after disconnection');
    console.log('✓ Test 5 passed: Lock properly released after client disconnection');
}

// Test 6: Forced unlocks
async function testForcedUnlocks(allClients: Client[]) {
    console.log('\nTest 6: Forced unlocks');

    const lockKey = 'remote-forced-unlock-test';
    let lockAcquiredByFirst = false;
    let lockAcquiredBySecond = false;

    // Create two clients
    const clients = await createClients(2);
    allClients.push(...clients);
    const [client1, client2] = clients;

    // First client acquires lock
    await new Promise<void>((resolve, reject) => {
        client1.lock(lockKey, (err) => {
            if (err) return reject(err);
            lockAcquiredByFirst = true;
            console.log('  First client acquired lock');
            resolve();
        });
    });

    // Second client tries to acquire same lock
    let secondClientError = false;
    try {
        await new Promise<void>((resolve, reject) => {
            client2.lock(lockKey, {maxRetries: 0}, (err) => {
                if (err) {
                    secondClientError = true;
                    resolve();
                } else {
                    reject(new Error('Second client should have failed with maxRetries:0'));
                }
            });
        });
    } catch (e) {
        console.error('  Error in second client maxRetries:0 test:', e);
    }

    assert.strictEqual(secondClientError, true, 'Second client should have failed with maxRetries:0');

    // Force unlock the lock from second client
    await new Promise<void>((resolve, reject) => {
        client2.unlock(lockKey, {force: true}, (err) => {
            if (err) return reject(err);
            console.log('  Second client force-unlocked the lock');
            resolve();
        });
    });

    // Now second client should be able to acquire the lock
    await new Promise<void>((resolve, reject) => {
        client2.lock(lockKey, (err, unlock2) => {
            if (err) return reject(err);

            lockAcquiredBySecond = true;
            console.log('  Second client acquired lock after force-unlock');

            unlock2((unlockErr) => {
                if (unlockErr) console.error('  Error releasing lock by second client:', unlockErr.message);
                resolve();
            });
        });
    });

    // Verify results
    assert.strictEqual(lockAcquiredByFirst, true, 'First client should have acquired the lock');
    assert.strictEqual(lockAcquiredBySecond, true, 'Second client should have acquired the lock after force-unlock');
    console.log('✓ Test 6 passed: Force unlock worked correctly');
}

// Test 7: Rapid lock/unlock cycles
async function testRapidLockUnlockCycles(allClients: Client[]) {
    console.log('\nTest 7: Rapid lock/unlock cycles');

    const cycles = 100; // Increased from 30
    const concurrentClients = 10; // Increased from 5
    const lockKey = 'remote-rapid-cycle-test';
    let completedCycles = 0;

    // Create clients for this test
    const clients = await createClients(concurrentClients, {
        lockRequestTimeout: 7000 // Longer timeout for this remote stress test
    });
    allClients.push(...clients);

    // Function to run a single lock/unlock cycle
    const runCycle = (client: Client): Promise<void> => {
        return new Promise((resolve) => {
            client.lock(lockKey, (err, unlock) => {
                if (err) {
                    console.error('  Lock cycle error:', err.message);
                    return resolve();
                }

                // Unlock immediately
                process.nextTick(() => {
                    unlock((unlockErr) => {
                        if (unlockErr) {
                            console.error('  Unlock cycle error:', unlockErr.message);
                        } else {
                            completedCycles++;
                        }
                        resolve();
                    });
                });
            });
        });
    };

    // Create all cycle promises
    const cyclePromises: Promise<void>[] = [];
    for (let i = 0; i < cycles; i++) {
        // Select a client for this cycle
        const client = clients[i % clients.length];
        cyclePromises.push(runCycle(client));
    }

    // Run all cycles
    await Promise.all(cyclePromises);

    // Verify results
    console.log(`  Completed ${completedCycles} out of ${cycles} lock/unlock cycles`);
    assert.ok(completedCycles > 0, 'Should have completed some cycles');
    assert.ok(completedCycles > cycles * 0.6, 'Should have completed at least 60% of cycles for remote broker');
    console.log(`✓ Test 7 passed: Completed ${completedCycles}/${cycles} rapid lock/unlock cycles`);
}

// Test 8: Promise-based API for lock/unlock
async function testPromiseBasedAPI(allClients: Client[]) {
    console.log('\nTest 8: Promise-based API for lock/unlock');

    const lockKey = 'remote-promise-api-test';
    const clientCount = 5;
    let successCount = 0;

    // Create clients
    const clients = await createClients(clientCount);
    allClients.push(...clients);

    // Test all clients sequentially to ensure predictable behavior
    for (const client of clients) {
        try {
            // Use acquireLock promise API instead of lock callback API
            const lock = await client.acquireLock(lockKey);
            console.log('  Client acquired lock via promise API');

            // Simulate some work
            await delay(50);

            // Use releaseLock promise API instead of unlock callback
            await client.releaseLock(lockKey, { _uuid: lock.lockUuid });
            console.log('  Client released lock via promise API');
            successCount++;
        } catch (err) {
            console.error('  Promise API error:', err);
        }
    }

    // Verify results
    assert.strictEqual(successCount, clientCount, 'All clients should successfully use promise API');
    console.log(`✓ Test 8 passed: All ${successCount} clients successfully used promise-based API`);
}

// Test 9: Cascading locks (lock multiple resources in sequence)
async function testCascadingLocks(allClients: Client[]) {
    console.log('\nTest 9: Cascading locks (acquiring multiple locks in sequence)');

    const lockKeys = ['resource-A', 'resource-B', 'resource-C', 'resource-D'];
    const clientCount = 3;
    let successCount = 0;

    // Create clients
    const clients = await createClients(clientCount);
    allClients.push(...clients);

    // Each client will attempt to lock all resources in sequence
    const lockPromises = clients.map((client, clientIndex) =>
        new Promise<void>(async (resolve) => {
            const lockHandles: any[] = [];
            let locked = true;

            try {
                // Acquire locks in sequence
                for (const key of lockKeys) {
                    const fullKey = `remote-cascading-${key}`;
                    await new Promise<void>((resolveLock, rejectLock) => {
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

                    // Small delay between acquisitions
                    await delay(20);
                }

                // Hold all locks for a brief period
                await delay(100);

                // Release locks in reverse order
                while (lockHandles.length > 0) {
                    const handle = lockHandles.pop();
                    await new Promise<void>((resolveUnlock) => {
                        handle.unlock((err: any) => {
                            if (err) {
                                console.error(`  Client ${clientIndex} error releasing ${handle.key}:`, err.message);
                            } else {
                                console.log(`  Client ${clientIndex} released lock ${handle.key}`);
                            }
                            resolveUnlock();
                        });
                    });
                }

                if (locked) {
                    successCount++;
                }
            } catch (err) {
                console.error(`  Client ${clientIndex} error in cascading locks:`, err);

                // Release any acquired locks
                while (lockHandles.length > 0) {
                    const handle = lockHandles.pop();
                    try {
                        await new Promise<void>((resolveUnlock) => {
                            handle.unlock((err: any) => resolveUnlock());
                        });
                    } catch (unlockErr) {
                        // Ignore unlock errors during cleanup
                    }
                }
            }

            resolve();
        })
    );

    await Promise.all(lockPromises);

    // Verify results
    assert.ok(successCount > 0, 'At least one client should succeed with cascading locks');
    console.log(`✓ Test 9 passed: ${successCount}/${clientCount} clients successfully acquired cascading locks`);
}

// Test 10: Lock contention with backpressure
async function testLockContentionWithBackpressure(allClients: Client[]) {
    console.log('\nTest 10: Lock contention with backpressure');

    const lockKey = 'remote-contention-test';
    const clientCount = 20;
    const holdDuration = 200; // ms
    let successCount = 0;
    let maxQueuedRequests = 0;

    // Create clients
    const clients = await createClients(clientCount);
    allClients.push(...clients);

    // Select one client to monitor lock info
    const monitorClient = clients[0];

    // Helper to check current lock queue size
    const checkQueueSize = async (): Promise<number> => {
        return new Promise((resolve, reject) => {
            monitorClient.requestLockInfo(lockKey, (err, info) => {
                if (err) return resolve(0);
                const queueSize = info?.data?.lockRequestCount || 0;
                maxQueuedRequests = Math.max(maxQueuedRequests, queueSize);
                resolve(queueSize);
            });
        });
    };

    // Create contention by having many clients try to lock simultaneously
    const contentionPromises = clients.map((client, idx) =>
        new Promise<void>(async (resolve) => {
            const startTime = Date.now();

            try {
                await new Promise<void>((resolveLock, rejectLock) => {
                    client.lock(lockKey, (err, unlock) => {
                        if (err) {
                            console.error(`  Client ${idx} failed to acquire lock:`, err.message);
                            return resolveLock(); // Continue even with error
                        }

                        const acquireTime = Date.now() - startTime;
                        console.log(`  Client ${idx} acquired lock after ${acquireTime}ms`);

                        // Hold the lock for the specified duration
                        setTimeout(() => {
                            unlock((unlockErr) => {
                                if (unlockErr) {
                                    console.error(`  Client ${idx} error releasing lock:`, unlockErr.message);
                                } else {
                                    successCount++;
                                }
                                resolveLock();
                            });
                        }, holdDuration);
                    });
                });
            } catch (err) {
                console.error(`  Client ${idx} error in contention test:`, err);
            }

            resolve();
        })
    );

    // Monitor queue size periodically
    const monitorPromise = (async () => {
        for (let i = 0; i < 10; i++) {
            await delay(200);
            const queueSize = await checkQueueSize();
            console.log(`  Current lock request queue size: ${queueSize}`);
        }
    })();

    // Wait for all clients to complete and monitoring to finish
    await Promise.all([...contentionPromises, monitorPromise]);

    // Verify results
    console.log(`  Max queued lock requests: ${maxQueuedRequests}`);
    assert.ok(successCount > 0, 'Some clients should successfully acquire and release the lock');
    assert.ok(maxQueuedRequests > 0, 'Should have observed queued lock requests');
    console.log(`✓ Test 10 passed: ${successCount}/${clientCount} clients succeeded with max queue size of ${maxQueuedRequests}`);
}

// Test 11: TTL variations
async function testTTLVariations(allClients: Client[]) {
    console.log('\nTest 11: TTL variations');

    const lockKeyPrefix = 'remote-ttl-test-';
    const ttlValues = [500, 1000, 2000, 5000]; // Different TTL values to test
    const results: { ttl: number, expired: boolean }[] = [];

    // Create clients
    const clients = await createClients(ttlValues.length * 2);
    allClients.push(...clients);

    // Test each TTL value
    const ttlPromises = ttlValues.map((ttl, idx) =>
        new Promise<void>(async (resolve) => {
            const lockKey = `${lockKeyPrefix}${ttl}`;
            const client1 = clients[idx * 2];
            const client2 = clients[idx * 2 + 1];

            try {
                // First client acquires lock with specified TTL
                await new Promise<void>((resolveLock, rejectLock) => {
                    client1.lock(lockKey, { ttl }, (err) => {
                        if (err) return rejectLock(err);
                        console.log(`  Client acquired lock with TTL ${ttl}ms`);
                        resolveLock();
                    });
                });

                // Wait for 75% of TTL
                await delay(ttl * 0.75);

                // Try to acquire the lock with second client - should fail
                let earlyAcquisitionFailed = false;
                try {
                    await new Promise<void>((resolveLock, rejectLock) => {
                        client2.lock(lockKey, { maxRetries: 0 }, (err) => {
                            if (err) {
                                earlyAcquisitionFailed = true;
                                resolveLock();
                            } else {
                                // Lock was acquired too early - this is unexpected
                                rejectLock(new Error(`Lock was acquired before TTL expired (${ttl}ms)`));
                            }
                        });
                    });
                } catch (err) {
                    console.error(`  Error testing TTL ${ttl}ms:`, err);
                }

                assert.strictEqual(earlyAcquisitionFailed, true, `Lock should not be acquirable before TTL expires (${ttl}ms)`);

                // Wait for the remaining TTL plus a small buffer
                await delay(ttl * 0.3 + 500);

                // Now try to acquire the lock after TTL expires
                let lockAcquiredAfterTTL = false;
                try {
                    await new Promise<void>((resolveLock, rejectLock) => {
                        client2.lock(lockKey, (err, unlock) => {
                            if (err) {
                                return rejectLock(new Error(`Failed to acquire lock after TTL expired (${ttl}ms): ${err.message}`));
                            }

                            lockAcquiredAfterTTL = true;
                            console.log(`  Lock acquired after TTL ${ttl}ms expired`);

                            unlock((unlockErr) => {
                                if (unlockErr) console.error(`  Error releasing lock with TTL ${ttl}ms:`, unlockErr.message);
                                resolveLock();
                            });
                        });
                    });
                } catch (err) {
                    console.error(`  Error testing TTL ${ttl}ms expiration:`, err);
                }

                results.push({ ttl, expired: lockAcquiredAfterTTL });

            } catch (err) {
                console.error(`  Error in TTL test for ${ttl}ms:`, err);
                results.push({ ttl, expired: false });
            }

            resolve();
        })
    );

    await Promise.all(ttlPromises);

    // Verify results
    const allExpired = results.every(r => r.expired);
    assert.strictEqual(allExpired, true, 'All locks should have expired after their TTL');
    console.log(`✓ Test 11 passed: All ${results.length} TTL variations correctly expired`);
}

// Test 12: System stability under load
async function testSystemStabilityUnderLoad(allClients: Client[]) {
    console.log('\nTest 12: System stability under load');

    const lockCount = 20;
    const clientCount = 15;
    const operationsPerClient = 50;
    let completedOperations = 0;
    let errors = 0;

    // Create clients
    const clients = await createClients(clientCount);
    allClients.push(...clients);

    // Create a set of different lock keys
    const lockKeys = Array.from({ length: lockCount }, (_, i) => `remote-stability-test-${i}`);

    // Each client performs multiple operations
    const clientPromises = clients.map((client, clientIndex) =>
        new Promise<void>(async (resolve) => {
            // Each client performs multiple operations
            for (let i = 0; i < operationsPerClient; i++) {
                try {
                    // Select a random lock key
                    const lockKey = lockKeys[Math.floor(Math.random() * lockKeys.length)];

                    // Random operation: lock, check, unlock
                    await new Promise<void>((resolveOp, rejectOp) => {
                        // Add small random delay to stagger operations
                        setTimeout(() => {
                            client.lock(lockKey, (err, unlock) => {
                                if (err) {
                                    errors++;
                                    return resolveOp();
                                }

                                // Hold lock briefly
                                setTimeout(() => {
                                    unlock((unlockErr) => {
                                        if (unlockErr) {
                                            errors++;
                                        } else {
                                            completedOperations++;
                                        }
                                        resolveOp();
                                    });
                                }, 5 + Math.random() * 20);
                            });
                        }, Math.random() * 50);
                    });

                    // Occasionally check system stats
                    if (i % 20 === 0) {
                        try {
                            await client.getSystemStats();
                        } catch (err) {
                            // Ignore stats errors
                        }
                    }

                } catch (err) {
                    errors++;
                    console.error(`  Client ${clientIndex} error:`, err);
                }

                // Progress update every 100 operations
                if ((clientIndex * operationsPerClient + i) % 100 === 0) {
                    console.log(`  Completed ${completedOperations} operations with ${errors} errors`);
                }
            }

            resolve();
        })
    );

    await Promise.all(clientPromises);

    // Verify results
    const totalOperations = clientCount * operationsPerClient;
    const successRate = (completedOperations / totalOperations) * 100;

    console.log(`  Completed ${completedOperations}/${totalOperations} operations (${successRate.toFixed(2)}%) with ${errors} errors`);
    assert.ok(successRate > 80, `Success rate should be above 80%, got ${successRate.toFixed(2)}%`);
    console.log(`✓ Test 12 passed: System remained stable under load with ${successRate.toFixed(2)}% success rate`);
}

// Test 13: Lock reacquisition
async function testLockReacquisition(allClients: Client[]) {
    console.log('\nTest 13: Lock reacquisition');

    const lockKey = 'remote-reacquisition-test';
    const reacquisitions = 10;
    let successCount = 0;

    // Create a client
    const clients = await createClients(1);
    allClients.push(...clients);
    const client = clients[0];

    // Acquire and release the same lock multiple times
    for (let i = 0; i < reacquisitions; i++) {
        try {
            // Use promise API for cleaner sequential code
            const lock = await client.acquireLock(lockKey);
            console.log(`  Acquired lock iteration ${i+1}`);

            // Brief hold
            await delay(50);

            await client.releaseLock(lockKey, { _uuid: lock.lockUuid });
            console.log(`  Released lock iteration ${i+1}`);

            successCount++;
        } catch (err) {
            console.error(`  Error in reacquisition test iteration ${i+1}:`, err);
        }
    }

    // Verify results
    assert.strictEqual(successCount, reacquisitions, `Should have successfully reacquired the lock ${reacquisitions} times`);
    console.log(`✓ Test 13 passed: Successfully reacquired the same lock ${successCount} times`);
}

// Test 14: Staggered client connections and disconnections
async function testStaggeredClientConnections(allClients: Client[]) {
    console.log('\nTest 14: Staggered client connections and disconnections');

    const lockKey = 'remote-staggered-test';
    const totalClients = 10;
    let operationsCompleted = 0;

    // Start with just one client
    const initialClient = new Client({
        host: REMOTE_HOST,
        port: REMOTE_PORT
    });
    await initialClient.ensure();
    allClients.push(initialClient);

    // Main test function
    const runTest = async () => {
        const activeClients: Client[] = [initialClient];

        // Queue for tracking operations
        const operationQueue: Promise<void>[] = [];

        // Add initial operation
        operationQueue.push(
            new Promise<void>(async (resolve) => {
                try {
                    const lock = await initialClient.acquireLock(lockKey);
                    console.log('  Initial client acquired lock');

                    await delay(100);

                    await initialClient.releaseLock(lockKey, { _uuid: lock.lockUuid });
                    console.log('  Initial client released lock');
                    operationsCompleted++;
                } catch (err) {
                    console.error('  Initial operation error:', err);
                }
                resolve();
            })
        );

        // Gradually add clients and operations
        for (let i = 1; i < totalClients; i++) {
            // Create and connect a new client
            const newClient = new Client({
                host: REMOTE_HOST,
                port: REMOTE_PORT
            });
            await newClient.ensure();
            activeClients.push(newClient);
            allClients.push(newClient);
            console.log(`  Added client ${i+1}`);

            // Add operation for the new client
            operationQueue.push(
                new Promise<void>(async (resolve) => {
                    try {
                        const lock = await newClient.acquireLock(lockKey);
                        console.log(`  Client ${i+1} acquired lock`);

                        await delay(50 + Math.random() * 100);

                        await newClient.releaseLock(lockKey, { _uuid: lock.lockUuid });
                        console.log(`  Client ${i+1} released lock`);
                        operationsCompleted++;
                    } catch (err) {
                        console.error(`  Client ${i+1} operation error:`, err);
                    }
                    resolve();
                })
            );

            // Occasionally disconnect a random client (except the last one added)
            if (i > 2 && i % 3 === 0) {
                const disconnectIndex = Math.floor(Math.random() * (activeClients.length - 1));
                const clientToDisconnect = activeClients[disconnectIndex];

                // Remove from active clients but keep in allClients for cleanup
                activeClients.splice(disconnectIndex, 1);

                console.log(`  Disconnecting a client (index ${disconnectIndex})`);
                clientToDisconnect.close();
            }

            // Add a small delay between client additions
            await delay(100);
        }

        // Wait for all operations to complete
        await Promise.all(operationQueue);
    };

    await runTest();

    // Verify results
    console.log(`  Completed ${operationsCompleted} operations with staggered clients`);
    assert.ok(operationsCompleted > 0, 'Some operations should have completed successfully');
    console.log(`✓ Test 14 passed: Successfully managed staggered client connections and disconnections`);
}

// Test 15: Ping/connectivity tests
async function testPingConnectivity(allClients: Client[]) {
    console.log('\nTest 15: Ping/connectivity tests');

    // Create a client
    const clients = await createClients(1);
    allClients.push(...clients);
    const client = clients[0];

    // Perform multiple pings
    const pingResults: number[] = [];
    const pingCount = 10;

    for (let i = 0; i < pingCount; i++) {
        try {
            const result = await client.ping();
            pingResults.push(result.roundTripTime);
            console.log(`  Ping ${i+1}: ${result.roundTripTime}ms round trip time`);

            // Small delay between pings
            await delay(50);
        } catch (err) {
            console.error(`  Ping ${i+1} error:`, err);
        }
    }

    // Also test system stats
    try {
        const stats = await client.getSystemStats();
        console.log(`  System stats: ${stats.broker.connectedClients} connected clients`);
    } catch (err) {
        console.error('  System stats error:', err);
    }

    // Verify results
    assert.ok(pingResults.length > 0, 'Should have received ping responses');
    const avgPing = pingResults.reduce((sum, time) => sum + time, 0) / pingResults.length;
    console.log(`  Average ping round trip time: ${avgPing.toFixed(2)}ms`);
    console.log(`✓ Test 15 passed: Successfully completed ping connectivity tests`);
}

// Run all tests
runAllTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
