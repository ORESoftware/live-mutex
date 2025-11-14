#!/usr/bin/env node

'use strict';

// Enable debug logging
process.argv.push('--lmx-debug');
process.env.lmx_debug = 'yes';

const {Broker, RWLockClient, RWLockWritePrefClient, Client} = require('../dist/main');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Debug logging utility
const debug = {
    log: (...args) => console.log('[DEBUG]', new Date().toISOString(), ...args),
    error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
    warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
    memory: () => {
        const mem = getMemoryUsage();
        console.log('[MEMORY]', formatMemory(mem));
    }
};

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

// Create a temporary file for testing
function createTmpFile() {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `lmx-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`);
    fs.writeFileSync(tmpFile, '0\n', 'utf8');
    return tmpFile;
}

function readFileValue(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return parseInt(content.trim(), 10) || 0;
    } catch (err) {
        return 0;
    }
}

function writeFileValue(filePath, value) {
    fs.writeFileSync(filePath, `${value}\n`, 'utf8');
}

function appendFileValue(filePath, value) {
    fs.appendFileSync(filePath, `${value}\n`, 'utf8');
}

async function testRWLockWithFile() {
    console.log('\n=== Testing RW Lock with File Operations ===');
    debug.log('Starting RW Lock test');
    
    const broker = new Broker({port: 6976});
    debug.log('Broker created, ensuring...');
    await broker.ensure();
    debug.log('Broker ensured');
    
    // Set up broker event listeners
    broker.emitter.on('warning', (msg) => {
        debug.warn('[BROKER WARNING]', msg);
    });
    broker.emitter.on('error', (err) => {
        debug.error('[BROKER ERROR]', err);
    });
    
    const client = new RWLockClient({port: 6976});
    debug.log('Client created, ensuring...');
    await client.ensure();
    debug.log('Client ensured');
    
    // Set up client event listeners
    client.emitter.on('warning', (msg) => {
        debug.warn('[CLIENT WARNING]', msg);
    });
    client.emitter.on('error', (err) => {
        debug.error('[CLIENT ERROR]', err);
    });
    
    const tmpFile = createTmpFile();
    const readKey = 'read-key';
    const writeKey = 'write-key';
    
    console.log('Using temp file:', tmpFile);
    console.log('Initial file value:', readFileValue(tmpFile));
    
    // Test 1: Multiple readers can read simultaneously
    console.log('\n--- Test 1: Multiple concurrent readers ---');
    debug.log('Starting test 1: Multiple concurrent readers');
    const readerPromises = [];
    for (let i = 0; i < 5; i++) {
        readerPromises.push(new Promise((resolve, reject) => {
            debug.log(`Reader ${i}: Requesting read lock...`);
            client.beginRead(readKey, {writeKey}, (err, release) => {
                if (err) {
                    debug.error(`Reader ${i}: Error acquiring read lock:`, err);
                    return reject(err);
                }
                
                debug.log(`Reader ${i}: Read lock acquired`);
                const value = readFileValue(tmpFile);
                console.log(`Reader ${i} read value: ${value}`);
                
                setTimeout(() => {
                    debug.log(`Reader ${i}: Releasing read lock...`);
                    release((releaseErr) => {
                        if (releaseErr) {
                            debug.error(`Reader ${i}: Error releasing read lock:`, releaseErr);
                            return reject(releaseErr);
                        }
                        debug.log(`Reader ${i}: Read lock released`);
                        resolve();
                    });
                }, 50);
            });
        }));
    }
    
    await Promise.all(readerPromises);
    console.log('✅ Multiple readers completed successfully');
    
    // Test 2: Writer is exclusive
    console.log('\n--- Test 2: Writer exclusivity ---');
    debug.log('Starting test 2: Writer exclusivity');
    let writeValue = 100;
    await new Promise((resolve, reject) => {
        debug.log('Requesting write lock...');
        client.beginWrite(writeKey, {}, (err, release) => {
            if (err) {
                debug.error('Error acquiring write lock:', err);
                return reject(err);
            }
            
            debug.log('Write lock acquired');
            writeFileValue(tmpFile, writeValue);
            console.log(`Writer wrote value: ${writeValue}`);
            
            // Try to read while write lock is held (should wait)
            let readAttempted = false;
            debug.log('Attempting read while write lock is held...');
            client.beginRead(readKey, {writeKey}, (readErr, readRelease) => {
                readAttempted = true;
                debug.log('Read lock callback invoked');
                if (readErr) {
                    debug.error('Read error during write:', readErr);
                    console.error('Read error during write:', readErr);
                    return reject(readErr);
                }
                
                debug.log('Read lock acquired after write');
                const readValue = readFileValue(tmpFile);
                console.log(`Read after write completed, value: ${readValue}`);
                
                if (readValue !== writeValue) {
                    return reject(new Error(`Expected ${writeValue}, got ${readValue}`));
                }
                
                debug.log('Releasing read lock...');
                readRelease((releaseErr) => {
                    if (releaseErr) {
                        debug.error('Error releasing read lock:', releaseErr);
                        return reject(releaseErr);
                    }
                    debug.log('Read lock released');
                    resolve();
                });
            });
            
            setTimeout(() => {
                if (!readAttempted) {
                    debug.log('Read is waiting (as expected)');
                    console.log('Read is waiting (as expected)');
                }
                debug.log('Releasing write lock...');
                release((releaseErr) => {
                    if (releaseErr) {
                        debug.error('Error releasing write lock:', releaseErr);
                    } else {
                        debug.log('Write lock released');
                    }
                });
            }, 100);
        });
    });
    console.log('✅ Writer exclusivity test passed');
    
    // Test 3: Multiple writes are serialized
    console.log('\n--- Test 3: Multiple writes serialized ---');
    const writePromises = [];
    for (let i = 0; i < 5; i++) {
        writePromises.push(new Promise((resolve, reject) => {
            client.beginWrite(writeKey, {}, (err, release) => {
                if (err) return reject(err);
                
                const currentValue = readFileValue(tmpFile);
                const newValue = currentValue + 1;
                writeFileValue(tmpFile, newValue);
                console.log(`Write ${i}: ${currentValue} -> ${newValue}`);
                
                setTimeout(() => {
                    release((releaseErr) => {
                        if (releaseErr) return reject(releaseErr);
                        resolve();
                    });
                }, 20);
            });
        }));
    }
    
    await Promise.all(writePromises);
    const finalValue = readFileValue(tmpFile);
    console.log(`Final value after 5 writes: ${finalValue}`);
    
    if (finalValue !== 105) {
        throw new Error(`Expected final value 105, got ${finalValue}`);
    }
    console.log('✅ Multiple writes serialized correctly');
    
    // Cleanup
    fs.unlinkSync(tmpFile);
    await new Promise(resolve => broker.close(resolve));
    client.close();
    
    return {success: true};
}

async function testRWLockWritePrefWithFile() {
    console.log('\n=== Testing RW Lock Write Preferred with File Operations ===');
    debug.log('Starting RW Lock Write Preferred test');
    
    const broker = new Broker({port: 6977});
    debug.log('Broker created, ensuring...');
    await broker.ensure();
    debug.log('Broker ensured');
    
    broker.emitter.on('warning', (msg) => debug.warn('[BROKER WARNING]', msg));
    broker.emitter.on('error', (err) => debug.error('[BROKER ERROR]', err));
    
    const client = new RWLockWritePrefClient({port: 6977});
    debug.log('Client created, ensuring...');
    await client.ensure();
    debug.log('Client ensured');
    
    client.emitter.on('warning', (msg) => debug.warn('[CLIENT WARNING]', msg));
    client.emitter.on('error', (err) => debug.error('[CLIENT ERROR]', err));
    
    const tmpFile = createTmpFile();
    const key = 'test-key';
    
    console.log('Using temp file:', tmpFile);
    
    // Test: Write preferred behavior
    console.log('\n--- Test: Write preferred lock ---');
    
    // Start a write operation
    let writeCompleted = false;
    debug.log('Requesting write lock...');
    const writePromise = new Promise((resolve, reject) => {
        client.acquireWriteLock(key, {}, (err, release) => {
            if (err) {
                debug.error('Error acquiring write lock:', err);
                return reject(err);
            }
            
            debug.log('Write lock acquired');
            writeFileValue(tmpFile, 200);
            console.log('Write lock acquired, wrote 200');
            
            setTimeout(() => {
                debug.log('Releasing write lock...');
                release((releaseErr) => {
                    if (releaseErr) {
                        debug.error('Error releasing write lock:', releaseErr);
                        return reject(releaseErr);
                    }
                    writeCompleted = true;
                    debug.log('Write lock released');
                    console.log('Write lock released');
                    resolve();
                });
            }, 100);
        });
    });
    
    // Try to read while write is in progress
    const readPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
            debug.log('Requesting read lock (while write is in progress)...');
            client.acquireReadLock(key, {}, (err, release) => {
                if (err) {
                    debug.error('Error acquiring read lock:', err);
                    return reject(err);
                }
                
                debug.log('Read lock acquired');
                const value = readFileValue(tmpFile);
                console.log(`Read lock acquired, read value: ${value}`);
                
                if (value !== 200) {
                    return reject(new Error(`Expected 200, got ${value}`));
                }
                
                debug.log('Releasing read lock...');
                release((releaseErr) => {
                    if (releaseErr) {
                        debug.error('Error releasing read lock:', releaseErr);
                        return reject(releaseErr);
                    }
                    debug.log('Read lock released');
                    resolve();
                });
            });
        }, 50); // Start read after write has started
    });
    
    await Promise.all([writePromise, readPromise]);
    console.log('✅ Write preferred lock test passed');
    
    // Cleanup
    fs.unlinkSync(tmpFile);
    await new Promise(resolve => broker.close(resolve));
    client.close();
    
    return {success: true};
}

async function testSemaphoreLogic() {
    console.log('\n=== Testing Semaphore Logic ===');
    debug.log('Starting semaphore test');
    
    const broker = new Broker({port: 6978});
    debug.log('Broker created, ensuring...');
    await broker.ensure();
    debug.log('Broker ensured');
    
    broker.emitter.on('warning', (msg) => debug.warn('[BROKER WARNING]', msg));
    broker.emitter.on('error', (err) => debug.error('[BROKER ERROR]', err));
    
    const clients = [];
    debug.log('Creating 10 clients...');
    for (let i = 0; i < 10; i++) {
        const client = new Client({port: 6978});
        await client.ensure();
        client.emitter.on('warning', (msg) => debug.warn(`[CLIENT ${i} WARNING]`, msg));
        client.emitter.on('error', (err) => debug.error(`[CLIENT ${i} ERROR]`, err));
        clients.push(client);
    }
    debug.log('All clients created');
    
    const maxHolders = 3;
    const key = 'semaphore-key';
    const activeHolders = {count: 0};
    const errors = [];
    
    console.log(`Testing semaphore with max=${maxHolders} and ${clients.length} clients`);
    
    const startMemory = getMemoryUsage();
    console.log('Initial memory:', formatMemory(startMemory));
    
    // Create many concurrent lock requests
    const lockPromises = [];
    debug.log(`Creating ${50} concurrent lock requests...`);
    for (let i = 0; i < 50; i++) {
        const client = clients[i % clients.length];
        const requestId = i;
        lockPromises.push(new Promise((resolve, reject) => {
            debug.log(`Request ${requestId}: Acquiring lock...`);
            client.lock(key, {max: maxHolders}, (err, unlock) => {
                if (err) {
                    debug.error(`Request ${requestId}: Error acquiring lock:`, err);
                    errors.push(err);
                    return reject(err);
                }
                
                activeHolders.count++;
                debug.log(`Request ${requestId}: Lock acquired. Active holders: ${activeHolders.count}/${maxHolders}`);
                
                // Verify we never exceed max
                if (activeHolders.count > maxHolders) {
                    const error = new Error(`Semaphore limit exceeded: ${activeHolders.count} > ${maxHolders}`);
                    debug.error(`Request ${requestId}: ${error.message}`);
                    errors.push(error);
                    activeHolders.count--;
                    return unlock((unlockErr) => {
                        reject(error);
                    });
                }
                
                const holdTime = Math.random() * 50;
                setTimeout(() => {
                    activeHolders.count--;
                    debug.log(`Request ${requestId}: Releasing lock. Active holders: ${activeHolders.count}/${maxHolders}`);
                    unlock((unlockErr) => {
                        if (unlockErr) {
                            debug.error(`Request ${requestId}: Error releasing lock:`, unlockErr);
                            errors.push(unlockErr);
                            return reject(unlockErr);
                        }
                        debug.log(`Request ${requestId}: Lock released successfully`);
                        resolve();
                    });
                }, holdTime);
            });
        }));
    }
    
    try {
        await Promise.all(lockPromises);
    } catch (err) {
        console.error('Error in semaphore test:', err);
    }
    
    const endMemory = getMemoryUsage();
    console.log('Final memory:', formatMemory(endMemory));
    
    const memoryGrowth = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed
    };
    
    console.log('Memory growth:', memoryGrowth);
    
    if (errors.length > 0) {
        console.error(`❌ Semaphore test failed with ${errors.length} errors`);
        errors.slice(0, 5).forEach(err => console.error('  Error:', err.message));
        throw new Error(`Semaphore test failed: ${errors.length} errors`);
    }
    
    if (activeHolders.count !== 0) {
        throw new Error(`Active holders not zero: ${activeHolders.count}`);
    }
    
    console.log('✅ Semaphore logic test passed');
    
    // Cleanup
    await new Promise(resolve => broker.close(resolve));
    clients.forEach(c => c.close());
    
    return {success: true, errors: errors.length, memoryGrowth};
}

async function testConcurrentRWOperations() {
    console.log('\n=== Testing Concurrent RW Operations ===');
    debug.log('Starting concurrent RW operations test');
    
    const broker = new Broker({port: 6979});
    debug.log('Broker created, ensuring...');
    await broker.ensure();
    debug.log('Broker ensured');
    
    broker.emitter.on('warning', (msg) => debug.warn('[BROKER WARNING]', msg));
    broker.emitter.on('error', (err) => debug.error('[BROKER ERROR]', err));
    
    const clients = [];
    debug.log('Creating 5 clients...');
    for (let i = 0; i < 5; i++) {
        const client = new RWLockWritePrefClient({port: 6979});
        await client.ensure();
        client.emitter.on('warning', (msg) => debug.warn(`[CLIENT ${i} WARNING]`, msg));
        client.emitter.on('error', (err) => debug.error(`[CLIENT ${i} ERROR]`, err));
        clients.push(client);
    }
    debug.log('All clients created');
    
    const tmpFile = createTmpFile();
    const key = 'concurrent-key';
    let writeCount = 0;
    let readCount = 0;
    
    console.log('Using temp file:', tmpFile);
    
    // Mix of reads and writes
    const operations = [];
    debug.log('Creating 20 mixed read/write operations...');
    for (let i = 0; i < 20; i++) {
        const client = clients[i % clients.length];
        const isWrite = Math.random() > 0.5;
        const opId = i;
        
        operations.push(new Promise((resolve, reject) => {
            if (isWrite) {
                writeCount++;
                debug.log(`Operation ${opId}: Requesting write lock...`);
                client.acquireWriteLock(key, {}, (err, release) => {
                    if (err) {
                        debug.error(`Operation ${opId}: Error acquiring write lock:`, err);
                        return reject(err);
                    }
                    
                    debug.log(`Operation ${opId}: Write lock acquired`);
                    const current = readFileValue(tmpFile);
                    writeFileValue(tmpFile, current + 1);
                    debug.log(`Operation ${opId}: Wrote value ${current + 1}`);
                    
                    setTimeout(() => {
                        debug.log(`Operation ${opId}: Releasing write lock...`);
                        release((releaseErr) => {
                            if (releaseErr) {
                                debug.error(`Operation ${opId}: Error releasing write lock:`, releaseErr);
                                return reject(releaseErr);
                            }
                            debug.log(`Operation ${opId}: Write lock released`);
                            resolve();
                        });
                    }, 10);
                });
            } else {
                readCount++;
                debug.log(`Operation ${opId}: Requesting read lock...`);
                client.acquireReadLock(key, {}, (err, release) => {
                    if (err) {
                        debug.error(`Operation ${opId}: Error acquiring read lock:`, err);
                        return reject(err);
                    }
                    
                    debug.log(`Operation ${opId}: Read lock acquired`);
                    const value = readFileValue(tmpFile);
                    debug.log(`Operation ${opId}: Read value ${value}`);
                    // Just verify we can read
                    
                    setTimeout(() => {
                        debug.log(`Operation ${opId}: Releasing read lock...`);
                        release((releaseErr) => {
                            if (releaseErr) {
                                debug.error(`Operation ${opId}: Error releasing read lock:`, releaseErr);
                                return reject(releaseErr);
                            }
                            debug.log(`Operation ${opId}: Read lock released`);
                            resolve();
                        });
                    }, 10);
                });
            }
        }));
    }
    
    await Promise.all(operations);
    
    const finalValue = readFileValue(tmpFile);
    console.log(`Operations: ${writeCount} writes, ${readCount} reads`);
    console.log(`Final file value: ${finalValue}`);
    
    if (finalValue !== writeCount) {
        throw new Error(`Expected final value ${writeCount}, got ${finalValue}`);
    }
    
    console.log('✅ Concurrent RW operations test passed');
    
    // Cleanup
    fs.unlinkSync(tmpFile);
    await new Promise(resolve => broker.close(resolve));
    clients.forEach(c => c.close());
    
    return {success: true};
}

async function runAllTests() {
    console.log('========================================');
    console.log('RW Lock and Semaphore Test Suite');
    console.log('========================================');
    console.log('Node version:', process.version);
    console.log('Platform:', os.platform());
    console.log('========================================\n');
    
    const results = {
        rwLock: null,
        rwLockWritePref: null,
        semaphore: null,
        concurrentRW: null
    };
    
    try {
        results.rwLock = await testRWLockWithFile();
        console.log('✅ RW Lock test passed');
    } catch (err) {
        console.error('❌ RW Lock test failed:', err);
        results.rwLock = {success: false, error: err.message};
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        results.rwLockWritePref = await testRWLockWritePrefWithFile();
        console.log('✅ RW Lock Write Preferred test passed');
    } catch (err) {
        console.error('❌ RW Lock Write Preferred test failed:', err);
        results.rwLockWritePref = {success: false, error: err.message};
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        results.semaphore = await testSemaphoreLogic();
        console.log('✅ Semaphore test passed');
    } catch (err) {
        console.error('❌ Semaphore test failed:', err);
        results.semaphore = {success: false, error: err.message};
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        results.concurrentRW = await testConcurrentRWOperations();
        console.log('✅ Concurrent RW operations test passed');
    } catch (err) {
        console.error('❌ Concurrent RW operations test failed:', err);
        results.concurrentRW = {success: false, error: err.message};
    }
    
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    
    let failures = 0;
    for (const [testName, result] of Object.entries(results)) {
        if (result && result.success) {
            console.log(`✅ ${testName}: PASSED`);
        } else {
            console.error(`❌ ${testName}: FAILED`);
            if (result && result.error) {
                console.error(`   Error: ${result.error}`);
            }
            failures++;
        }
    }
    
    console.log('========================================');
    if (failures === 0) {
        console.log('✅ All tests passed!');
        process.exit(0);
    } else {
        console.error(`❌ ${failures} test(s) failed!`);
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

