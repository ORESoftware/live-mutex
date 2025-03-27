import * as assert from 'assert';
import { Client } from '../src/client';

/**
 * Standalone test script for remote Live Mutex broker with concurrent requests
 * Tests various race conditions and concurrency scenarios using promises
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
    console.log(`Starting Live Mutex tests against remote broker at ${REMOTE_HOST}:${REMOTE_PORT}`);
    const allClients: Client[] = [];

    try {
        // Test 1: Multiple clients competing for the same lock
        await testMultipleClientsForSameLock(allClients);

        // Test 2: Semaphore with multiple holders
        // await testSemaphoreWithMultipleHolders(allClients);

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
    const clientCount = 10;
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

                // Simulate some work
                setTimeout(() => {
                    unlock((unlockErr) => {
                        if (unlockErr) console.error('  Error releasing lock:', unlockErr.message);
                        resolve();
                    });
                }, 100);
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
    const clientCount = 10;
    let concurrentHolders = 0;
    let maxConcurrentHolders = 0;
    let completedCount = 0;

    // Create multiple clients
    const clients = await createClients(clientCount);
    allClients.push(...clients);

    // Have all clients try to acquire the same semaphore lock simultaneously
    const lockPromises = clients.map(client =>
        new Promise<void>((resolve) => {
            client.lock(lockKey, {max: MAX_HOLDERS}, (err, unlock) => {
                if (err) {
                    console.error('  Error acquiring semaphore:', err.message);
                    return resolve();
                }

                // Track concurrent holders
                concurrentHolders++;
                maxConcurrentHolders = Math.max(maxConcurrentHolders, concurrentHolders);

                assert.ok(concurrentHolders <= MAX_HOLDERS,
                    `Too many concurrent holders: ${concurrentHolders} > ${MAX_HOLDERS}`);

                // Simulate some work with random duration
                setTimeout(() => {
                    concurrentHolders--;
                    completedCount++;

                    unlock((unlockErr) => {
                        if (unlockErr) console.error('  Error releasing semaphore:', unlockErr.message);
                        resolve();
                    });
                }, 50 + Math.random() * 150);
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
    const operationCount = 20;
    let completedCount = 0;

    // Create clients
    const clients = await createClients(5);
    allClients.push(...clients);

    // Create operation promises
    const operationPromises = Array.from({ length: operationCount }).map((_, n) =>
        new Promise<void>((resolve) => {
            const randomClient = clients[Math.floor(Math.random() * clients.length)];
            const lockKey = `${lockPrefix}${n % 5}`; // Use 5 different lock keys

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
        client1.lock(lockKey, {ttl: 1000}, (err) => { // Longer TTL for remote testing
            if (err) return reject(err);
            console.log('  First client acquired lock (will expire)');
            resolve();
        });
    });

    // Wait for lock to expire
    console.log('  Waiting for lock to expire...');
    await delay(2000); // Longer wait for remote testing

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
    await delay(1500); // Longer wait for remote broker detection

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

    const cycles = 30; // Reduced cycle count for remote testing
    const concurrentClients = 5;
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

// Run all tests
runAllTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
