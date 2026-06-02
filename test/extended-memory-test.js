#!/usr/bin/env node
'use strict';

/**
 * Extended long-running memory leak test
 * Runs for 5 minutes with continuous operations to thoroughly test for memory leaks
 */

const { Broker1 } = require('../dist/broker-1');
const { Client } = require('../dist/client');
const { RWLockWritePrefClient } = require('../dist/rw-write-preferred-client');

const TEST_DURATION = 300000; // 5 minutes
const CLIENT_COUNT = 50;
const OPERATIONS_PER_SECOND = 20;
const PORT = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT, 10) : 5555;

const memorySnapshots = [];
let operationCount = 0;
let errorCount = 0;

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
    const elapsed = memorySnapshots.length > 1 
        ? ((mem.timestamp - memorySnapshots[0].timestamp) / 1000).toFixed(1) + 's'
        : '0s';
    console.log(`[${time}] [${elapsed}] ${label}:`);
    console.log(`  Heap Used: ${formatBytes(mem.heapUsed)}`);
    console.log(`  Heap Total: ${formatBytes(mem.heapTotal)}`);
    console.log(`  RSS: ${formatBytes(mem.rss)}`);
    console.log(`  External: ${formatBytes(mem.external)}`);
    
    if (memorySnapshots.length > 1) {
        const first = memorySnapshots[0];
        const heapGrowth = mem.heapUsed - first.heapUsed;
        const heapGrowthPercent = ((heapGrowth / first.heapUsed) * 100).toFixed(2);
        const rssGrowth = mem.rss - first.rss;
        const rssGrowthPercent = ((rssGrowth / first.rss) * 100).toFixed(2);
        console.log(`  Growth: Heap ${formatBytes(heapGrowth)} (${heapGrowthPercent}%), RSS ${formatBytes(rssGrowth)} (${rssGrowthPercent}%)`);
    }
    console.log('');
}

function analyzeMemoryGrowth() {
    if (memorySnapshots.length < 2) {
        console.log('Not enough snapshots for analysis');
        return false;
    }

    const first = memorySnapshots[0];
    const last = memorySnapshots[memorySnapshots.length - 1];
    const duration = (last.timestamp - first.timestamp) / 1000;

    const heapGrowth = last.heapUsed - first.heapUsed;
    const rssGrowth = last.rss - first.rss;
    const heapGrowthPercent = (heapGrowth / first.heapUsed) * 100;
    const rssGrowthPercent = (rssGrowth / first.rss) * 100;

    console.log('\n=== Detailed Memory Growth Analysis ===');
    console.log(`Test Duration: ${(duration / 60).toFixed(2)} minutes`);
    console.log(`Total Operations: ${operationCount}`);
    console.log(`Total Errors: ${errorCount}`);
    console.log(`Operations/Second: ${(operationCount / duration).toFixed(2)}`);
    console.log('');
    console.log(`Initial Memory:`);
    console.log(`  Heap: ${formatBytes(first.heapUsed)}`);
    console.log(`  RSS: ${formatBytes(first.rss)}`);
    console.log('');
    console.log(`Final Memory:`);
    console.log(`  Heap: ${formatBytes(last.heapUsed)}`);
    console.log(`  RSS: ${formatBytes(last.rss)}`);
    console.log('');
    console.log(`Total Growth:`);
    console.log(`  Heap: ${formatBytes(heapGrowth)} (${heapGrowthPercent.toFixed(2)}%)`);
    console.log(`  RSS: ${formatBytes(rssGrowth)} (${rssGrowthPercent.toFixed(2)}%)`);
    console.log(`  Growth Rate: ${formatBytes(heapGrowth / (duration / 60))} per minute`);

    // Check for leaks
    let hasLeak = false;
    const warnings = [];

    // Check absolute growth
    if (heapGrowth > 100 * 1024 * 1024) { // 100 MB
        warnings.push(`⚠️  WARNING: Heap grew by more than 100 MB (${formatBytes(heapGrowth)})`);
        hasLeak = true;
    } else if (heapGrowth > 50 * 1024 * 1024) { // 50 MB
        warnings.push(`⚠️  CAUTION: Heap grew by more than 50 MB (${formatBytes(heapGrowth)})`);
    }

    // Check percentage growth (but only if starting heap was reasonable)
    if (first.heapUsed > 10 * 1024 * 1024) { // Only check if started with > 10 MB
        if (heapGrowthPercent > 100) {
            warnings.push(`⚠️  WARNING: Heap grew by more than 100% (${heapGrowthPercent.toFixed(2)}%)`);
            hasLeak = true;
        } else if (heapGrowthPercent > 50) {
            warnings.push(`⚠️  CAUTION: Heap grew by more than 50% (${heapGrowthPercent.toFixed(2)}%)`);
        }
    }

    // Check for accelerating growth
    if (memorySnapshots.length >= 5) {
        const segments = Math.floor(memorySnapshots.length / 3);
        const early = memorySnapshots[segments];
        const mid = memorySnapshots[segments * 2];
        const late = last;

        const earlyGrowth = (early.heapUsed - first.heapUsed) / ((early.timestamp - first.timestamp) / 1000);
        const midGrowth = (mid.heapUsed - early.heapUsed) / ((mid.timestamp - early.timestamp) / 1000);
        const lateGrowth = (late.heapUsed - mid.heapUsed) / ((late.timestamp - mid.timestamp) / 1000);

        if (lateGrowth > midGrowth * 1.5 && lateGrowth > earlyGrowth * 2) {
            warnings.push(`⚠️  WARNING: Accelerating memory growth detected!`);
            warnings.push(`  Early: ${formatBytes(earlyGrowth)}/s, Mid: ${formatBytes(midGrowth)}/s, Late: ${formatBytes(lateGrowth)}/s`);
            hasLeak = true;
        }
    }

    // Check RSS growth
    if (rssGrowth > 200 * 1024 * 1024) { // 200 MB
        warnings.push(`⚠️  WARNING: RSS grew by more than 200 MB (${formatBytes(rssGrowth)})`);
        hasLeak = true;
    }

    if (warnings.length > 0) {
        console.log('\n=== Warnings ===');
        warnings.forEach(w => console.log(w));
    } else {
        console.log('\n✓ No significant memory leaks detected');
    }

    return hasLeak;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runLockOperation(client, key) {
    return new Promise((resolve) => {
        client.lock(key, { ttl: 3000 }, (err, unlock) => {
            if (err) {
                errorCount++;
                return resolve();
            }
            setTimeout(() => {
                unlock(() => resolve());
            }, 50 + Math.random() * 150);
        });
    });
}

async function runSemaphoreOperation(client, key, max) {
    return new Promise((resolve) => {
        client.lock(key, { max, ttl: 3000 }, (err, unlock) => {
            if (err) {
                errorCount++;
                return resolve();
            }
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
                if (err) {
                    errorCount++;
                    return resolve();
                }
                setTimeout(() => {
                    release(() => resolve());
                }, 50 + Math.random() * 100);
            });
        } else {
            client.acquireReadLock(key, {}, (err, release) => {
                if (err) {
                    errorCount++;
                    return resolve();
                }
                setTimeout(() => {
                    release(() => resolve());
                }, 50 + Math.random() * 100);
            });
        }
    });
}

async function runExtendedMemoryTest() {
    console.log('=== Extended Long-Running Memory Leak Test ===\n');
    console.log(`Configuration:`);
    console.log(`  Duration: ${TEST_DURATION / 1000 / 60} minutes`);
    console.log(`  Client Count: ${CLIENT_COUNT}`);
    console.log(`  Operations/Second: ${OPERATIONS_PER_SECOND}`);
    console.log(`  Expected Total Operations: ~${Math.floor(TEST_DURATION / 1000 * OPERATIONS_PER_SECOND)}\n`);

    let broker = null;
    const clients = [];
    const rwClients = [];

    try {
        logMemory('Initial Memory State');

        // Start broker
        console.log('Starting broker...');
        broker = new Broker1({
            port: PORT,
            lockExpiresAfter: 10000,
            timeoutToFindNewLockholder: 5000
        });

        await broker.ensure();
        console.log('✓ Broker started\n');

        // Create clients
        console.log('Creating clients...');
        for (let i = 0; i < CLIENT_COUNT; i++) {
            const client = new Client({ port: PORT, lockRequestTimeout: 5000 });
            await client.ensure();
            clients.push(client);
            if ((i + 1) % 10 === 0) {
                process.stdout.write(`  Created ${i + 1}/${CLIENT_COUNT} clients\r`);
            }
        }

        for (let i = 0; i < 10; i++) {
            const client = new RWLockWritePrefClient({ port: PORT, lockRequestTimeout: 5000 });
            await client.ensure();
            rwClients.push(client);
        }

        console.log(`\n✓ Created ${CLIENT_COUNT} standard clients and 10 RW clients\n`);
        logMemory('After Client Creation');

        // Run operations
        const startTime = Date.now();
        const endTime = startTime + TEST_DURATION;
        const operationInterval = 1000 / OPERATIONS_PER_SECOND;
        let lastMemoryLog = Date.now();
        const memoryLogInterval = 30000; // Log every 30 seconds

        console.log(`Starting extended stress test for ${TEST_DURATION / 1000 / 60} minutes...\n`);

        const keys = ['key-1', 'key-2', 'key-3', 'key-4', 'semaphore-key', 'rw-key-1', 'rw-key-2'];

        while (Date.now() < endTime) {
            const elapsed = Date.now() - startTime;
            const remaining = endTime - Date.now();

            // Log memory periodically
            if (Date.now() - lastMemoryLog >= memoryLogInterval) {
                const elapsedMin = Math.floor(elapsed / 1000 / 60);
                const elapsedSec = Math.floor((elapsed / 1000) % 60);
                const remainingMin = Math.floor(remaining / 1000 / 60);
                const remainingSec = Math.floor((remaining / 1000) % 60);
                logMemory(`Memory Check (${elapsedMin}m ${elapsedSec}s elapsed, ${remainingMin}m ${remainingSec}s remaining)`);
                lastMemoryLog = Date.now();
            }

            // Run operations
            const promises = [];

            // Standard locks (multiple per cycle)
            for (let i = 0; i < 8; i++) {
                const client = clients[Math.floor(Math.random() * clients.length)];
                const key = keys[Math.floor(Math.random() * keys.length)];
                promises.push(runLockOperation(client, key));
            }

            // Semaphore operations
            for (let i = 0; i < 2; i++) {
                const semaphoreClient = clients[Math.floor(Math.random() * clients.length)];
                promises.push(runSemaphoreOperation(semaphoreClient, 'semaphore-key', 5));
            }

            // RW locks
            for (let i = 0; i < 2; i++) {
                if (rwClients.length > 0) {
                    const rwClient = rwClients[Math.floor(Math.random() * rwClients.length)];
                    const isWrite = Math.random() > 0.5;
                    promises.push(runRWOperation(rwClient, 'rw-key-' + (i + 1), isWrite));
                }
            }

            await Promise.all(promises);
            operationCount += promises.length;

            // Progress indicator
            if (operationCount % 100 === 0) {
                process.stdout.write(`  Operations: ${operationCount}, Errors: ${errorCount}\r`);
            }

            await delay(operationInterval);
        }

        console.log(`\n✓ Stress test completed`);
        console.log(`  Total operations: ${operationCount}`);
        console.log(`  Errors: ${errorCount}\n`);

        logMemory('After Stress Test');

        // Wait for cleanup
        console.log('Waiting 10 seconds for cleanup...');
        await delay(10000);

        logMemory('After Cleanup Wait');

        // Close clients
        console.log('Closing clients...');
        for (let i = 0; i < clients.length; i++) {
            clients[i].close();
            if ((i + 1) % 10 === 0) {
                process.stdout.write(`  Closed ${i + 1}/${clients.length} clients\r`);
            }
        }
        for (const client of rwClients) {
            client.close();
        }
        console.log(`\n✓ All ${clients.length + rwClients.length} clients closed\n`);

        logMemory('After Client Cleanup');

        // Wait a bit more
        await delay(5000);

        logMemory('After Additional Wait');

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
        console.error(error.stack);
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
runExtendedMemoryTest();
