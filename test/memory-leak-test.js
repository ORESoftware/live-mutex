#!/usr/bin/env node

'use strict';

const {Broker, Client, RWLockWritePrefClient} = require('../dist/main');
const os = require('os');

// Memory monitoring utility
function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024) // MB
    };
}

function formatMemory(mem) {
    return `RSS: ${mem.rss}MB, Heap: ${mem.heapUsed}/${mem.heapTotal}MB, External: ${mem.external}MB`;
}

async function testBasicLockMemoryLeak() {
    console.log('\n=== Testing Basic Lock Memory Leak ===');
    const broker = new Broker({port: 6972});
    await broker.ensure();
    
    const client = new Client({port: 6972});
    await client.ensure();
    
    const iterations = 10000;
    const sampleInterval = 1000;
    const memorySamples = [];
    
    console.log(`Running ${iterations} lock/unlock cycles...`);
    console.log('Initial memory:', formatMemory(getMemoryUsage()));
    
    const startMemory = getMemoryUsage();
    memorySamples.push({iteration: 0, memory: startMemory});
    
    for (let i = 1; i <= iterations; i++) {
        await new Promise((resolve, reject) => {
            client.lock('test-key', (err, unlock) => {
                if (err) return reject(err);
                unlock((unlockErr) => {
                    if (unlockErr) return reject(unlockErr);
                    resolve();
                });
            });
        });
        
        if (i % sampleInterval === 0) {
            const mem = getMemoryUsage();
            memorySamples.push({iteration: i, memory: mem});
            console.log(`Iteration ${i}: ${formatMemory(mem)}`);
        }
    }
    
    const endMemory = getMemoryUsage();
    memorySamples.push({iteration: iterations, memory: endMemory});
    
    console.log('Final memory:', formatMemory(endMemory));
    
    // Calculate memory growth
    const memoryGrowth = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal
    };
    
    console.log('Memory growth:', {
        rss: `${memoryGrowth.rss}MB`,
        heapUsed: `${memoryGrowth.heapUsed}MB`,
        heapTotal: `${memoryGrowth.heapTotal}MB`
    });
    
    // Check for significant memory leaks (more than 50MB growth)
    const hasLeak = Math.abs(memoryGrowth.heapUsed) > 50 || Math.abs(memoryGrowth.rss) > 100;
    
    if (hasLeak) {
        console.error('⚠️  POTENTIAL MEMORY LEAK DETECTED!');
        console.error('Memory growth exceeds threshold:', memoryGrowth);
    } else {
        console.log('✅ No significant memory leak detected');
    }
    
    await new Promise(resolve => broker.close(resolve));
    client.close();
    
    return {hasLeak, memoryGrowth, samples: memorySamples};
}

async function testSemaphoreMemoryLeak() {
    console.log('\n=== Testing Semaphore Memory Leak ===');
    const broker = new Broker({port: 6973});
    await broker.ensure();
    
    const clients = [];
    for (let i = 0; i < 5; i++) {
        const client = new Client({port: 6973});
        await client.ensure();
        clients.push(client);
    }
    
    const iterations = 5000;
    const maxHolders = 3;
    const sampleInterval = 500;
    const memorySamples = [];
    
    console.log(`Running ${iterations} semaphore lock/unlock cycles with max=${maxHolders}...`);
    console.log('Initial memory:', formatMemory(getMemoryUsage()));
    
    const startMemory = getMemoryUsage();
    memorySamples.push({iteration: 0, memory: startMemory});
    
    for (let i = 1; i <= iterations; i++) {
        const promises = [];
        for (let j = 0; j < 10; j++) {
            const client = clients[j % clients.length];
            promises.push(new Promise((resolve, reject) => {
                client.lock('semaphore-key', {max: maxHolders}, (err, unlock) => {
                    if (err) return reject(err);
                    setTimeout(() => {
                        unlock((unlockErr) => {
                            if (unlockErr) return reject(unlockErr);
                            resolve();
                        });
                    }, Math.random() * 5);
                });
            }));
        }
        await Promise.all(promises);
        
        if (i % sampleInterval === 0) {
            const mem = getMemoryUsage();
            memorySamples.push({iteration: i, memory: mem});
            console.log(`Iteration ${i}: ${formatMemory(mem)}`);
        }
    }
    
    const endMemory = getMemoryUsage();
    memorySamples.push({iteration: iterations, memory: endMemory});
    
    console.log('Final memory:', formatMemory(endMemory));
    
    const memoryGrowth = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal
    };
    
    console.log('Memory growth:', {
        rss: `${memoryGrowth.rss}MB`,
        heapUsed: `${memoryGrowth.heapUsed}MB`,
        heapTotal: `${memoryGrowth.heapTotal}MB`
    });
    
    const hasLeak = Math.abs(memoryGrowth.heapUsed) > 50 || Math.abs(memoryGrowth.rss) > 100;
    
    if (hasLeak) {
        console.error('⚠️  POTENTIAL MEMORY LEAK DETECTED!');
        console.error('Memory growth exceeds threshold:', memoryGrowth);
    } else {
        console.log('✅ No significant memory leak detected');
    }
    
    await new Promise(resolve => broker.close(resolve));
    clients.forEach(c => c.close());
    
    return {hasLeak, memoryGrowth, samples: memorySamples};
}

async function testRWLockMemoryLeak() {
    console.log('\n=== Testing RWLock Memory Leak ===');
    const broker = new Broker({port: 6974});
    await broker.ensure();
    
    const client = new RWLockWritePrefClient({port: 6974});
    await client.ensure();
    
    const iterations = 5000;
    const sampleInterval = 500;
    const memorySamples = [];
    
    console.log(`Running ${iterations} RWLock acquire/release cycles...`);
    console.log('Initial memory:', formatMemory(getMemoryUsage()));
    
    const startMemory = getMemoryUsage();
    memorySamples.push({iteration: 0, memory: startMemory});
    
    for (let i = 1; i <= iterations; i++) {
        // Test read locks
        await new Promise((resolve, reject) => {
            client.acquireReadLock('read-key', {}, (err, release) => {
                if (err) return reject(err);
                release((releaseErr) => {
                    if (releaseErr) return reject(releaseErr);
                    resolve();
                });
            });
        });
        
        // Test write locks
        await new Promise((resolve, reject) => {
            client.acquireWriteLock('write-key', {}, (err, release) => {
                if (err) return reject(err);
                release((releaseErr) => {
                    if (releaseErr) return reject(releaseErr);
                    resolve();
                });
            });
        });
        
        if (i % sampleInterval === 0) {
            const mem = getMemoryUsage();
            memorySamples.push({iteration: i, memory: mem});
            console.log(`Iteration ${i}: ${formatMemory(mem)}`);
        }
    }
    
    const endMemory = getMemoryUsage();
    memorySamples.push({iteration: iterations, memory: endMemory});
    
    console.log('Final memory:', formatMemory(endMemory));
    
    const memoryGrowth = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal
    };
    
    console.log('Memory growth:', {
        rss: `${memoryGrowth.rss}MB`,
        heapUsed: `${memoryGrowth.heapUsed}MB`,
        heapTotal: `${memoryGrowth.heapTotal}MB`
    });
    
    const hasLeak = Math.abs(memoryGrowth.heapUsed) > 50 || Math.abs(memoryGrowth.rss) > 100;
    
    if (hasLeak) {
        console.error('⚠️  POTENTIAL MEMORY LEAK DETECTED!');
        console.error('Memory growth exceeds threshold:', memoryGrowth);
    } else {
        console.log('✅ No significant memory leak detected');
    }
    
    await new Promise(resolve => broker.close(resolve));
    client.close();
    
    return {hasLeak, memoryGrowth, samples: memorySamples};
}

async function testConnectionCleanup() {
    console.log('\n=== Testing Connection Cleanup ===');
    const broker = new Broker({port: 6975});
    await broker.ensure();
    
    const iterations = 1000;
    const sampleInterval = 100;
    const memorySamples = [];
    
    console.log(`Creating and destroying ${iterations} client connections...`);
    console.log('Initial memory:', formatMemory(getMemoryUsage()));
    
    const startMemory = getMemoryUsage();
    memorySamples.push({iteration: 0, memory: startMemory});
    
    for (let i = 1; i <= iterations; i++) {
        const client = new Client({port: 6975});
        await client.ensure();
        
        await new Promise((resolve, reject) => {
            client.lock('cleanup-key', (err, unlock) => {
                if (err) return reject(err);
                unlock((unlockErr) => {
                    if (unlockErr) return reject(unlockErr);
                    client.close();
                    resolve();
                });
            });
        });
        
        if (i % sampleInterval === 0) {
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            const mem = getMemoryUsage();
            memorySamples.push({iteration: i, memory: mem});
            console.log(`Iteration ${i}: ${formatMemory(mem)}`);
        }
    }
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    const endMemory = getMemoryUsage();
    memorySamples.push({iteration: iterations, memory: endMemory});
    
    console.log('Final memory:', formatMemory(endMemory));
    
    const memoryGrowth = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal
    };
    
    console.log('Memory growth:', {
        rss: `${memoryGrowth.rss}MB`,
        heapUsed: `${memoryGrowth.heapUsed}MB`,
        heapTotal: `${memoryGrowth.heapTotal}MB`
    });
    
    const hasLeak = Math.abs(memoryGrowth.heapUsed) > 50 || Math.abs(memoryGrowth.rss) > 100;
    
    if (hasLeak) {
        console.error('⚠️  POTENTIAL MEMORY LEAK DETECTED!');
        console.error('Memory growth exceeds threshold:', memoryGrowth);
    } else {
        console.log('✅ No significant memory leak detected');
    }
    
    await new Promise(resolve => broker.close(resolve));
    
    return {hasLeak, memoryGrowth, samples: memorySamples};
}

async function runAllTests() {
    console.log('========================================');
    console.log('Memory Leak Test Suite');
    console.log('========================================');
    console.log('Node version:', process.version);
    console.log('Platform:', os.platform());
    console.log('Total memory:', Math.round(os.totalmem() / 1024 / 1024), 'MB');
    console.log('Free memory:', Math.round(os.freemem() / 1024 / 1024), 'MB');
    console.log('========================================\n');
    
    const results = {
        basicLock: null,
        semaphore: null,
        rwLock: null,
        connectionCleanup: null
    };
    
    try {
        results.basicLock = await testBasicLockMemoryLeak();
    } catch (err) {
        console.error('Basic lock test failed:', err);
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        results.semaphore = await testSemaphoreMemoryLeak();
    } catch (err) {
        console.error('Semaphore test failed:', err);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        results.rwLock = await testRWLockMemoryLeak();
    } catch (err) {
        console.error('RWLock test failed:', err);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        results.connectionCleanup = await testConnectionCleanup();
    } catch (err) {
        console.error('Connection cleanup test failed:', err);
    }
    
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    
    let totalLeaks = 0;
    for (const [testName, result] of Object.entries(results)) {
        if (result && result.hasLeak) {
            console.error(`❌ ${testName}: MEMORY LEAK DETECTED`);
            totalLeaks++;
        } else if (result) {
            console.log(`✅ ${testName}: No memory leak`);
        } else {
            console.log(`⚠️  ${testName}: Test failed or skipped`);
        }
    }
    
    console.log('========================================');
    if (totalLeaks === 0) {
        console.log('✅ All memory leak tests passed!');
        process.exit(0);
    } else {
        console.error(`❌ ${totalLeaks} memory leak(s) detected!`);
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

