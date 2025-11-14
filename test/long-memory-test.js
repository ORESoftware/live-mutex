#!/usr/bin/env node
'use strict';

/**
 * Long-running memory leak test
 * Runs for 2 minutes with continuous operations to detect memory leaks
 */

const { Broker1 } = require('../dist/broker-1');
const { Client } = require('../dist/client');
const { RWLockWritePrefClient } = require('../dist/rw-write-preferred-client');

const TEST_DURATION = 120000; // 2 minutes
const CLIENT_COUNT = 30;
const OPERATIONS_PER_SECOND = 15;
const PORT = 7777;

const memorySnapshots = [];

function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
        external: usage.external,
        timestamp: Date.now()
    };
}

function formatBytes(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function logMemory(label) {
    const mem = getMemoryUsage();
    memorySnapshots.push(mem);
    const time = new Date().toISOString();
    console.log(`[${time}] ${label}:`);
    console.log(`  Heap Used: ${formatBytes(mem.heapUsed)}`);
    console.log(`  Heap Total: ${formatBytes(mem.heapTotal)}`);
    console.log(`  RSS: ${formatBytes(mem.rss)}`);
    console.log(`  External: ${formatBytes(mem.external)}`);
}

function analyzeMemoryGrowth() {
    if (memorySnapshots.length < 2) {
        console.log('Not enough snapshots for analysis');
        return;
    }

    const first = memorySnapshots[0];
    const last = memorySnapshots[memorySnapshots.length - 1];
    const duration = (last.timestamp - first.timestamp) / 1000;

    const heapGrowth = last.heapUsed - first.heapUsed;
    const rssGrowth = last.rss - first.rss;
    const heapGrowthPercent = (heapGrowth / first.heapUsed) * 100;
    const rssGrowthPercent = (rssGrowth / first.rss) * 100;

    console.log('\n=== Memory Growth Analysis ===');
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Heap Growth: ${formatBytes(heapGrowth)} (${heapGrowthPercent.toFixed(2)}%)`);
    console.log(`RSS Growth: ${formatBytes(rssGrowth)} (${rssGrowthPercent.toFixed(2)}%)`);

    // Check for leaks
    let hasLeak = false;
    if (heapGrowthPercent > 50 || rssGrowthPercent > 50) {
        console.log('⚠️  WARNING: Significant memory growth detected - potential memory leak!');
        hasLeak = true;
    } else if (heapGrowthPercent > 20 || rssGrowthPercent > 20) {
        console.log('⚠️  CAUTION: Moderate memory growth detected');
    } else {
        console.log('✓ Memory growth appears normal');
    }

    // Check for accelerating growth
    if (memorySnapshots.length >= 5) {
        const midPoint = Math.floor(memorySnapshots.length / 2);
        const mid = memorySnapshots[midPoint];
        const earlyGrowth = (mid.heapUsed - first.heapUsed) / (mid.timestamp - first.timestamp);
        const lateGrowth = (last.heapUsed - mid.heapUsed) / (last.timestamp - mid.timestamp);

        if (lateGrowth > earlyGrowth * 1.5) {
            console.log('⚠️  WARNING: Accelerating memory growth detected - likely memory leak!');
            hasLeak = true;
        }
    }

    return hasLeak;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runLockOperation(client, key) {
    return new Promise((resolve) => {
        client.lock(key, { ttl: 2000 }, (err, unlock) => {
            if (err) return resolve();
            setTimeout(() => {
                unlock(() => resolve());
            }, 50 + Math.random() * 150);
        });
    });
}

async function runSemaphoreOperation(client, key, max) {
    return new Promise((resolve) => {
        client.lock(key, { max, ttl: 2000 }, (err, unlock) => {
            if (err) return resolve();
            setTimeout(() => {
                unlock(() => resolve());
            }, 100 + Math.random() * 200);
        });
    });
}

async function runRWOperation(client, key, isWrite) {
    return new Promise((resolve) => {
        if (isWrite) {
            client.acquireWriteLock(key, {}, (err, release) => {
                if (err) return resolve();
                setTimeout(() => {
                    release(() => resolve());
                }, 50 + Math.random() * 100);
            });
        } else {
            client.acquireReadLock(key, {}, (err, release) => {
                if (err) return resolve();
                setTimeout(() => {
                    release(() => resolve());
                }, 50 + Math.random() * 100);
            });
        }
    });
}

async function runLongMemoryTest() {
    console.log('=== Long-Running Memory Leak Test ===\n');
    console.log(`Configuration:`);
    console.log(`  Duration: ${TEST_DURATION / 1000} seconds`);
    console.log(`  Client Count: ${CLIENT_COUNT}`);
    console.log(`  Operations/Second: ${OPERATIONS_PER_SECOND}\n`);

    let broker = null;
    const clients = [];
    const rwClients = [];

    try {
        logMemory('Initial Memory State');

        // Start broker
        console.log('Starting broker...');
        broker = new Broker1({
            port: PORT,
            lockExpiresAfter: 5000,
            timeoutToFindNewLockholder: 2000
        });

        await broker.ensure();
        console.log('✓ Broker started\n');

        // Create clients
        console.log('Creating clients...');
        for (let i = 0; i < CLIENT_COUNT; i++) {
            const client = new Client({ port: PORT, lockRequestTimeout: 3000 });
            await client.ensure();
            clients.push(client);
        }

        for (let i = 0; i < 5; i++) {
            const client = new RWLockWritePrefClient({ port: PORT, lockRequestTimeout: 3000 });
            await client.ensure();
            rwClients.push(client);
        }

        console.log(`✓ Created ${CLIENT_COUNT} standard clients and 5 RW clients\n`);
        logMemory('After Client Creation');

        // Run operations
        const startTime = Date.now();
        const endTime = startTime + TEST_DURATION;
        let operationCount = 0;
        let errorCount = 0;
        const operationInterval = 1000 / OPERATIONS_PER_SECOND;
        let lastMemoryLog = Date.now();
        const memoryLogInterval = 20000; // Log every 20 seconds

        console.log(`Starting stress test for ${TEST_DURATION / 1000} seconds...\n`);

        const keys = ['key-1', 'key-2', 'key-3', 'semaphore-key', 'rw-key'];

        while (Date.now() < endTime) {
            const elapsed = Date.now() - startTime;
            const remaining = endTime - Date.now();

            // Log memory periodically
            if (Date.now() - lastMemoryLog >= memoryLogInterval) {
                logMemory(`Memory Check (${Math.floor(elapsed / 1000)}s elapsed, ${Math.floor(remaining / 1000)}s remaining)`);
                lastMemoryLog = Date.now();
            }

            // Run operations
            const promises = [];

            // Standard locks
            for (let i = 0; i < 5; i++) {
                const client = clients[Math.floor(Math.random() * clients.length)];
                const key = keys[Math.floor(Math.random() * keys.length)];
                promises.push(
                    runLockOperation(client, key).catch(() => errorCount++)
                );
            }

            // Semaphore
            const semaphoreClient = clients[Math.floor(Math.random() * clients.length)];
            promises.push(
                runSemaphoreOperation(semaphoreClient, 'semaphore-key', 5).catch(() => errorCount++)
            );

            // RW locks
            if (rwClients.length > 0) {
                const rwClient = rwClients[Math.floor(Math.random() * rwClients.length)];
                const isWrite = Math.random() > 0.5;
                promises.push(
                    runRWOperation(rwClient, 'rw-key', isWrite).catch(() => errorCount++)
                );
            }

            await Promise.all(promises);
            operationCount += promises.length;

            await delay(operationInterval);
        }

        console.log(`\n✓ Stress test completed`);
        console.log(`  Total operations: ${operationCount}`);
        console.log(`  Errors: ${errorCount}\n`);

        logMemory('After Stress Test');

        // Wait for cleanup
        console.log('Waiting 5 seconds for cleanup...');
        await delay(5000);

        logMemory('After Cleanup Wait');

        // Close clients
        console.log('Closing clients...');
        for (const client of clients) {
            client.close();
        }
        for (const client of rwClients) {
            client.close();
        }
        console.log('✓ All clients closed\n');

        logMemory('After Client Cleanup');

        // Close broker
        await new Promise((resolve) => {
            broker.close(() => resolve());
        });
        console.log('✓ Broker closed\n');

        logMemory('Final Memory State');

        // Analyze
        const hasLeak = analyzeMemoryGrowth();

        console.log('\n=== Test Complete ===');

        if (hasLeak) {
            console.log('⚠️  Memory leak detected!');
            process.exit(1);
        } else {
            console.log('✓ No significant memory leaks detected');
            process.exit(0);
        }

    } catch (error) {
        console.error('\n✗ Test failed:', error);
        process.exit(1);
    } finally {
        // Ensure cleanup
        try {
            for (const client of clients) {
                try { client.close(); } catch (e) {}
            }
            for (const client of rwClients) {
                try { client.close(); } catch (e) {}
            }
            if (broker) {
                await new Promise((resolve) => {
                    broker.close(() => resolve());
                });
            }
        } catch (err) {
            console.error('Error during final cleanup:', err);
        }
    }
}

// Run the test
runLongMemoryTest();

