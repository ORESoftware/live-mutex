#!/usr/bin/env node
'use strict';

/**
 * Long-running memory leak test for Live Mutex
 * This test runs for an extended period and monitors memory usage
 * to detect potential memory leaks from timers, event listeners, connections, etc.
 */

import * as assert from 'assert';
import { Broker1 } from '../dist/broker-1';
import { Client } from '../dist/client';
import { RWLockWritePrefClient } from '../dist/rw-write-preferred-client';

interface MemorySnapshot {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    timestamp: number;
}

// Helper to get memory usage
function getMemoryUsage(): MemorySnapshot {
    const usage = process.memoryUsage();
    return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss,
        timestamp: Date.now()
    };
}

// Helper to format bytes
function formatBytes(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Helper to create a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Track memory snapshots
const memorySnapshots: MemorySnapshot[] = [];

// Log memory usage
function logMemory(label: string) {
    const mem = getMemoryUsage();
    memorySnapshots.push(mem);
    console.log(`[${new Date().toISOString()}] ${label}:`);
    console.log(`  Heap Used: ${formatBytes(mem.heapUsed)}`);
    console.log(`  Heap Total: ${formatBytes(mem.heapTotal)}`);
    console.log(`  RSS: ${formatBytes(mem.rss)}`);
    console.log(`  External: ${formatBytes(mem.external)}`);
}

// Analyze memory growth
function analyzeMemoryGrowth() {
    if (memorySnapshots.length < 2) {
        console.log('Not enough snapshots for analysis');
        return;
    }

    const first = memorySnapshots[0];
    const last = memorySnapshots[memorySnapshots.length - 1];
    const duration = (last.timestamp - first.timestamp) / 1000; // seconds

    const heapGrowth = last.heapUsed - first.heapUsed;
    const rssGrowth = last.rss - first.rss;

    console.log('\n=== Memory Growth Analysis ===');
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Heap Growth: ${formatBytes(heapGrowth)} (${((heapGrowth / first.heapUsed) * 100).toFixed(2)}%)`);
    console.log(`RSS Growth: ${formatBytes(rssGrowth)} (${((rssGrowth / first.rss) * 100).toFixed(2)}%)`);

    // Check for significant growth (potential leak)
    const heapGrowthPercent = (heapGrowth / first.heapUsed) * 100;
    const rssGrowthPercent = (rssGrowth / first.rss) * 100;

    if (heapGrowthPercent > 50 || rssGrowthPercent > 50) {
        console.log('⚠️  WARNING: Significant memory growth detected - potential memory leak!');
    } else if (heapGrowthPercent > 20 || rssGrowthPercent > 20) {
        console.log('⚠️  CAUTION: Moderate memory growth detected');
    } else {
        console.log('✓ Memory growth appears normal');
    }

    // Check for linear growth pattern (bad sign)
    if (memorySnapshots.length >= 5) {
        const midPoint = Math.floor(memorySnapshots.length / 2);
        const mid = memorySnapshots[midPoint];
        const earlyGrowth = (mid.heapUsed - first.heapUsed) / (mid.timestamp - first.timestamp);
        const lateGrowth = (last.heapUsed - mid.heapUsed) / (last.timestamp - mid.timestamp);

        if (lateGrowth > earlyGrowth * 1.5) {
            console.log('⚠️  WARNING: Accelerating memory growth detected - likely memory leak!');
        }
    }
}

// Test configuration
const TEST_CONFIG = {
    port: 8888,
    duration: 120000, // 2 minutes
    clientCount: 20,
    operationsPerSecond: 10,
    semaphoreMax: 5,
    lockKeys: ['test-key-1', 'test-key-2', 'test-key-3', 'semaphore-key', 'rw-key']
};

// Create and manage clients
class ClientPool {
    private clients: Client[] = [];
    private rwClients: RWLockWritePrefClient[] = [];

    async createClients(count: number, port: number): Promise<void> {
        const promises: Promise<void>[] = [];
        for (let i = 0; i < count; i++) {
            promises.push(
                (async () => {
                    const client = new Client({ port, lockRequestTimeout: 3000 });
                    await client.ensure();
                    this.clients.push(client);
                })()
            );
        }
        await Promise.all(promises);
    }

    async createRWClients(count: number, port: number): Promise<void> {
        const promises: Promise<void>[] = [];
        for (let i = 0; i < count; i++) {
            promises.push(
                (async () => {
                    const client = new RWLockWritePrefClient({ port, lockRequestTimeout: 3000 });
                    await client.ensure();
                    this.rwClients.push(client);
                })()
            );
        }
        await Promise.all(promises);
    }

    getRandomClient(): Client {
        return this.clients[Math.floor(Math.random() * this.clients.length)];
    }

    getRandomRWClient(): RWLockWritePrefClient {
        return this.rwClients[Math.floor(Math.random() * this.rwClients.length)];
    }

    async closeAll(): Promise<void> {
        console.log('Closing all clients...');
        const closePromises: Promise<void>[] = [];

        for (const client of this.clients) {
            closePromises.push(
                new Promise<void>((resolve) => {
                    try {
                        client.close();
                        resolve();
                    } catch (err) {
                        console.error('Error closing client:', err);
                        resolve();
                    }
                })
            );
        }

        for (const client of this.rwClients) {
            closePromises.push(
                new Promise<void>((resolve) => {
                    try {
                        client.close();
                        resolve();
                    } catch (err) {
                        console.error('Error closing RW client:', err);
                        resolve();
                    }
                })
            );
        }

        await Promise.all(closePromises);
        this.clients = [];
        this.rwClients = [];
    }
}

// Run a single lock/unlock operation
async function runLockOperation(client: Client, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
        client.lock(key, { ttl: 1000 }, (err, unlock) => {
            if (err) {
                return resolve(); // Don't fail on errors, just continue
            }

            // Unlock after a short delay
            setTimeout(() => {
                unlock((unlockErr) => {
                    if (unlockErr) {
                        // Ignore unlock errors
                    }
                    resolve();
                });
            }, 50 + Math.random() * 100);
        });
    });
}

// Run a semaphore operation
async function runSemaphoreOperation(client: Client, key: string, max: number): Promise<void> {
    return new Promise((resolve) => {
        client.lock(key, { max, ttl: 1000 }, (err, unlock) => {
            if (err) {
                return resolve();
            }

            setTimeout(() => {
                unlock((unlockErr) => {
                    resolve();
                });
            }, 100 + Math.random() * 200);
        });
    });
}

// Run an RW lock operation
async function runRWOperation(client: RWLockWritePrefClient, key: string, isWrite: boolean): Promise<void> {
    return new Promise((resolve) => {
        if (isWrite) {
            client.acquireWriteLock(key, {}, (err, release) => {
                if (err) {
                    return resolve();
                }
                setTimeout(() => {
                    release((releaseErr) => {
                        resolve();
                    });
                }, 50 + Math.random() * 100);
            });
        } else {
            client.acquireReadLock(key, {}, (err, release) => {
                if (err) {
                    return resolve();
                }
                setTimeout(() => {
                    release((releaseErr) => {
                        resolve();
                    });
                }, 50 + Math.random() * 100);
            });
        }
    });
}

// Main test function
async function runMemoryLeakTest() {
    console.log('=== Live Mutex Memory Leak Test ===\n');
    console.log(`Test Configuration:`);
    console.log(`  Duration: ${TEST_CONFIG.duration / 1000} seconds`);
    console.log(`  Client Count: ${TEST_CONFIG.clientCount}`);
    console.log(`  Operations/Second: ${TEST_CONFIG.operationsPerSecond}`);
    console.log(`  Semaphore Max: ${TEST_CONFIG.semaphoreMax}\n`);

    let broker: Broker1 | null = null;
    const clientPool = new ClientPool();

    try {
        // Initial memory snapshot
        logMemory('Initial Memory State');

        // Start broker
        console.log('\nStarting broker...');
        broker = new Broker1({
            port: TEST_CONFIG.port,
            lockExpiresAfter: 5000,
            timeoutToFindNewLockholder: 2000
        });

        await broker.ensure();
        console.log('✓ Broker started\n');

        // Create clients
        console.log('Creating clients...');
        await clientPool.createClients(TEST_CONFIG.clientCount, TEST_CONFIG.port);
        await clientPool.createRWClients(5, TEST_CONFIG.port);
        console.log(`✓ Created ${TEST_CONFIG.clientCount} standard clients and 5 RW clients\n`);

        logMemory('After Client Creation');

        // Run operations for the specified duration
        const startTime = Date.now();
        const endTime = startTime + TEST_CONFIG.duration;
        let operationCount = 0;
        let errorCount = 0;

        console.log(`\nStarting stress test for ${TEST_CONFIG.duration / 1000} seconds...\n`);

        // Operation loop
        const operationInterval = 1000 / TEST_CONFIG.operationsPerSecond;
        let lastMemoryLog = Date.now();
        const memoryLogInterval = 30000; // Log memory every 30 seconds

        while (Date.now() < endTime) {
            const elapsed = Date.now() - startTime;
            const remaining = endTime - Date.now();

            // Log memory periodically
            if (Date.now() - lastMemoryLog >= memoryLogInterval) {
                logMemory(`Memory Check (${Math.floor(elapsed / 1000)}s elapsed, ${Math.floor(remaining / 1000)}s remaining)`);
                lastMemoryLog = Date.now();
            }

            // Run various operations
            const operationPromises: Promise<void>[] = [];

            // Standard lock operations
            for (let i = 0; i < 3; i++) {
                const client = clientPool.getRandomClient();
                const key = TEST_CONFIG.lockKeys[Math.floor(Math.random() * TEST_CONFIG.lockKeys.length)];
                operationPromises.push(
                    runLockOperation(client, key).catch(err => {
                        errorCount++;
                    })
                );
            }

            // Semaphore operations
            const semaphoreClient = clientPool.getRandomClient();
            operationPromises.push(
                runSemaphoreOperation(semaphoreClient, 'semaphore-key', TEST_CONFIG.semaphoreMax).catch(err => {
                    errorCount++;
                })
            );

            // RW lock operations
            const rwClient = clientPool.getRandomRWClient();
            const isWrite = Math.random() > 0.5;
            operationPromises.push(
                runRWOperation(rwClient, 'rw-key', isWrite).catch(err => {
                    errorCount++;
                })
            );

            await Promise.all(operationPromises);
            operationCount += operationPromises.length;

            // Small delay to control operation rate
            await delay(operationInterval);
        }

        console.log(`\n✓ Stress test completed`);
        console.log(`  Total operations: ${operationCount}`);
        console.log(`  Errors: ${errorCount}\n`);

        logMemory('After Stress Test');

        // Wait a bit for cleanup
        console.log('\nWaiting 5 seconds for cleanup...');
        await delay(5000);

        logMemory('After Cleanup Wait');

        // Close all clients
        await clientPool.closeAll();
        console.log('✓ All clients closed\n');

        logMemory('After Client Cleanup');

        // Close broker
        if (broker) {
            await new Promise<void>((resolve, reject) => {
                broker!.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log('✓ Broker closed\n');
        }

        logMemory('Final Memory State');

        // Analyze memory growth
        analyzeMemoryGrowth();

        console.log('\n=== Test Complete ===');

    } catch (error) {
        console.error('\n✗ Test failed:', error);
        throw error;
    } finally {
        // Ensure cleanup
        try {
            await clientPool.closeAll();
            if (broker) {
                await new Promise<void>((resolve) => {
                    broker!.close(() => resolve());
                });
            }
        } catch (err) {
            console.error('Error during final cleanup:', err);
        }
    }
}

// Run the test
if (require.main === module) {
    runMemoryLeakTest()
        .then(() => {
            console.log('\n✓ Memory leak test completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n✗ Memory leak test failed:', err);
            process.exit(1);
        });
}

export { runMemoryLeakTest };

