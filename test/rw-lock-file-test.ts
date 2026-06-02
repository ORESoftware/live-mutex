#!/usr/bin/env node

'use strict';

// Enable debug logging
process.argv.push('--lmx-debug');
process.env.lmx_debug = 'yes';

import {Broker1, RWLockClient, RWLockWritePrefClient, Client} from '../dist/main';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Debug logging utility
const debug = {
    log: (...args: any[]): void => console.log('[DEBUG]', new Date().toISOString(), ...args),
    error: (...args: any[]): void => console.error('[ERROR]', new Date().toISOString(), ...args),
    warn: (...args: any[]): void => console.warn('[WARN]', new Date().toISOString(), ...args),
    memory: (): void => {
        const mem = getMemoryUsage();
        console.log('[MEMORY]', formatMemory(mem));
    }
};

// Memory monitoring utility
interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
}

function getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    return {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024) // MB
    };
}

function formatMemory(mem: MemoryUsage): string {
    return `RSS: ${mem.rss}MB, Heap: ${mem.heapUsed}/${mem.heapTotal}MB, External: ${mem.external}MB`;
}

// Create a temporary file for testing
function createTmpFile(): string {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `lmx-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`);
    fs.writeFileSync(tmpFile, '0\n', 'utf8');
    return tmpFile;
}

function readFileValue(filePath: string): number {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return parseInt(content.trim(), 10) || 0;
    } catch (err) {
        return 0;
    }
}

function writeFileValue(filePath: string, value: number): void {
    fs.writeFileSync(filePath, `${value}\n`, 'utf8');
}

function appendFileValue(filePath: string, value: number): void {
    fs.appendFileSync(filePath, `${value}\n`, 'utf8');
}

const parsedTestPort = Number.parseInt(process.env.LMX_TEST_PORT || '', 10);
const testPortBase = Number.isInteger(parsedTestPort) ? parsedTestPort : 7000 + Math.floor(Math.random() * 1000);
let testPortOffset = 0;

function getNextPort(): number {
    return testPortBase + testPortOffset++;
}

interface TestResult {
    success: boolean;
    error?: string;
    errors?: number;
    memoryGrowth?: {
        rss: number;
        heapUsed: number;
    };
}

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`${errorMsg} (timeout after ${timeoutMs}ms)`)), timeoutMs)
        )
    ]);
}

function closeClient(client: {close: () => void}): void {
    try { client.close(); } catch (e) {}
}

async function closeBroker(broker: Broker1): Promise<void> {
    await Promise.race([
        new Promise<void>(resolve => broker.close(() => resolve())),
        new Promise<void>(resolve => setTimeout(resolve, 2000))
    ]);
}

async function testRWLockWithFile(): Promise<TestResult> {
    console.log('\n=== Testing RW Lock with File Operations ===');
    debug.log('Starting RW Lock test');
    
    const port = getNextPort();
    debug.log(`Using port: ${port}`);
    const broker = new Broker1({port});
    debug.log('Broker created, ensuring...');
    await withTimeout(broker.ensure(), 5000, 'Broker ensure timeout');
    debug.log('Broker ensured');
    
    // Set up broker event listeners
    broker.emitter.on('warning', (msg: any) => {
        debug.warn('[BROKER WARNING]', msg);
    });
    broker.emitter.on('error', (err: any) => {
        debug.error('[BROKER ERROR]', err);
    });
    
    const client = new RWLockClient({port, lockRequestTimeout: 30000});
    debug.log('Client created, ensuring...');
    await withTimeout(client.ensure(), 5000, 'Client ensure timeout');
    debug.log('Client ensured');
    
    // Set up client event listeners
    client.emitter.on('warning', (msg: any) => {
        debug.warn('[CLIENT WARNING]', msg);
    });
    client.emitter.on('error', (err: any) => {
        debug.error('[CLIENT ERROR]', err);
    });

    const readerClients: RWLockClient[] = [client];
    for (let i = 1; i < 5; i++) {
        const readerClient = new RWLockClient({port, lockRequestTimeout: 30000});
        await withTimeout(readerClient.ensure(), 5000, `Reader client ${i} ensure timeout`);
        readerClient.emitter.on('warning', (msg: any) => {
            debug.warn(`[READER CLIENT ${i} WARNING]`, msg);
        });
        readerClient.emitter.on('error', (err: any) => {
            debug.error(`[READER CLIENT ${i} ERROR]`, err);
        });
        readerClients.push(readerClient);
    }
    
    const tmpFile = createTmpFile();
    const readKey = 'read-key';
    const writeKey = 'write-key';
    
    console.log('Using temp file:', tmpFile);
    console.log('Initial file value:', readFileValue(tmpFile));

    try {
        // Test 1: Multiple readers can read simultaneously
        console.log('\n--- Test 1: Multiple concurrent readers ---');
        debug.log('Starting test 1: Multiple concurrent readers');
        const readerPromises: Promise<void>[] = [];
        for (let i = 0; i < 5; i++) {
            const readerClient = readerClients[i];
            readerPromises.push(withTimeout(new Promise<void>((resolve, reject) => {
                debug.log(`Reader ${i}: Requesting read lock...`);
                readerClient.beginRead(readKey, {writeKey}, (err: any, release: any) => {
                    if (err) {
                        debug.error(`Reader ${i}: Error acquiring read lock:`, err);
                        return reject(err);
                    }

                    debug.log(`Reader ${i}: Read lock acquired`);
                    const value = readFileValue(tmpFile);
                    console.log(`Reader ${i} read value: ${value}`);

                    setTimeout(() => {
                        debug.log(`Reader ${i}: Releasing read lock...`);
                        release((releaseErr: any) => {
                            if (releaseErr) {
                                debug.error(`Reader ${i}: Error releasing read lock:`, releaseErr);
                                return reject(releaseErr);
                            }
                            debug.log(`Reader ${i}: Read lock released`);
                            resolve();
                        });
                    }, 50);
                });
            }), 35000, `Reader ${i} timeout`));
        }

        await Promise.all(readerPromises);
        console.log('✅ Multiple readers completed successfully');

        // Test 2: Writer is exclusive
        console.log('\n--- Test 2: Writer exclusivity ---');
        debug.log('Starting test 2: Writer exclusivity');
        let writeValue = 100;
        await withTimeout(new Promise<void>((resolve, reject) => {
            debug.log('Requesting write lock...');
            client.beginWrite(writeKey, {}, (err: any, release: any) => {
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
                client.beginRead(readKey, {writeKey}, (readErr: any, readRelease: any) => {
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
                    readRelease((releaseErr: any) => {
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
                    release((releaseErr: any) => {
                        if (releaseErr) {
                            debug.error('Error releasing write lock:', releaseErr);
                        } else {
                            debug.log('Write lock released');
                        }
                    });
                }, 100);
            });
        }), 15000, 'Writer exclusivity test timeout');
        console.log('✅ Writer exclusivity test passed');

        // Test 3: Multiple writes are serialized
        console.log('\n--- Test 3: Multiple writes serialized ---');
        const writePromises: Promise<void>[] = [];
        for (let i = 0; i < 5; i++) {
            writePromises.push(new Promise<void>((resolve, reject) => {
                client.beginWrite(writeKey, {}, (err: any, release: any) => {
                    if (err) return reject(err);

                    const currentValue = readFileValue(tmpFile);
                    const newValue = currentValue + 1;
                    writeFileValue(tmpFile, newValue);
                    console.log(`Write ${i}: ${currentValue} -> ${newValue}`);

                    setTimeout(() => {
                        release((releaseErr: any) => {
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

        return {success: true};
    }
    finally {
        readerClients.forEach(closeClient);
        await closeBroker(broker);
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testRWLockWritePrefWithFile(): Promise<TestResult> {
    console.log('\n=== Testing RW Lock Write Preferred with File Operations ===');
    debug.log('Starting RW Lock Write Preferred test');
    
    const port = getNextPort();
    debug.log(`Using port: ${port}`);
    const broker = new Broker1({port});
    debug.log('Broker created, ensuring...');
    await broker.ensure();
    debug.log('Broker ensured');
    
    broker.emitter.on('warning', (msg: any) => debug.warn('[BROKER WARNING]', msg));
    broker.emitter.on('error', (err: any) => debug.error('[BROKER ERROR]', err));
    
    const client = new RWLockWritePrefClient({port});
    debug.log('Client created, ensuring...');
    await client.ensure();
    debug.log('Client ensured');
    
    client.emitter.on('warning', (msg: any) => debug.warn('[CLIENT WARNING]', msg));
    client.emitter.on('error', (err: any) => debug.error('[CLIENT ERROR]', err));
    
    const tmpFile = createTmpFile();
    const key = 'test-key';
    
    console.log('Using temp file:', tmpFile);
    
    // Test: Write preferred behavior
    console.log('\n--- Test: Write preferred lock ---');
    
    // Start a write operation
    let writeCompleted = false;
    debug.log('Requesting write lock...');
    const writePromise = new Promise<void>((resolve, reject) => {
        client.acquireWriteLock(key, {}, (err: any, release: any) => {
            if (err) {
                debug.error('Error acquiring write lock:', err);
                return reject(err);
            }
            
            debug.log('Write lock acquired');
            writeFileValue(tmpFile, 200);
            console.log('Write lock acquired, wrote 200');
            
            setTimeout(() => {
                debug.log('Releasing write lock...');
                release((releaseErr: any) => {
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
    const readPromise = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            debug.log('Requesting read lock (while write is in progress)...');
            client.acquireReadLock(key, {}, (err: any, release: any) => {
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
                release((releaseErr: any) => {
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
    closeClient(client);
    await closeBroker(broker);
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    
    return {success: true};
}

async function testSemaphoreLogic(): Promise<TestResult> {
    console.log('\n=== Testing Semaphore Logic ===');
    debug.log('Starting semaphore test');
    
    const port = getNextPort();
    debug.log(`Using port: ${port}`);
    const broker = new Broker1({port});
    debug.log('Broker created, ensuring...');
    await broker.ensure();
    debug.log('Broker ensured');
    
    broker.emitter.on('warning', (msg: any) => debug.warn('[BROKER WARNING]', msg));
    broker.emitter.on('error', (err: any) => debug.error('[BROKER ERROR]', err));
    
    const clients: Client[] = [];
    debug.log('Creating 10 clients...');
    for (let i = 0; i < 10; i++) {
        const client = new Client({port});
        await client.ensure();
        client.emitter.on('warning', (msg: any) => debug.warn(`[CLIENT ${i} WARNING]`, msg));
        client.emitter.on('error', (err: any) => debug.error(`[CLIENT ${i} ERROR]`, err));
        clients.push(client);
    }
    debug.log('All clients created');
    
    const maxHolders = 3;
    const key = 'semaphore-key';
    const activeHolders = {count: 0};
    const errors: Error[] = [];
    
    console.log(`Testing semaphore with max=${maxHolders} and ${clients.length} clients`);
    
    const startMemory = getMemoryUsage();
    console.log('Initial memory:', formatMemory(startMemory));
    
    // Create many concurrent lock requests
    const lockPromises: Promise<void>[] = [];
    debug.log(`Creating ${50} concurrent lock requests...`);
    for (let i = 0; i < 50; i++) {
        const client = clients[i % clients.length];
        const requestId = i;
        lockPromises.push(new Promise<void>((resolve, reject) => {
            debug.log(`Request ${requestId}: Acquiring lock...`);
            client.lock(key, {max: maxHolders}, (err: any, unlock: any) => {
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
                    return unlock((unlockErr: any) => {
                        reject(error);
                    });
                }
                
                const holdTime = Math.random() * 50;
                setTimeout(() => {
                    activeHolders.count--;
                    debug.log(`Request ${requestId}: Releasing lock. Active holders: ${activeHolders.count}/${maxHolders}`);
                    unlock((unlockErr: any) => {
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
    clients.forEach(closeClient);
    await closeBroker(broker);
    
    return {success: true, errors: errors.length, memoryGrowth};
}

async function testConcurrentRWOperations(): Promise<TestResult> {
    console.log('\n=== Testing Concurrent RW Operations ===');
    debug.log('Starting concurrent RW operations test');
    
    const port = getNextPort();
    debug.log(`Using port: ${port}`);
    const broker = new Broker1({port});
    debug.log('Broker created, ensuring...');
    await broker.ensure();
    debug.log('Broker ensured');
    
    broker.emitter.on('warning', (msg: any) => debug.warn('[BROKER WARNING]', msg));
    broker.emitter.on('error', (err: any) => debug.error('[BROKER ERROR]', err));
    
    const clients: RWLockWritePrefClient[] = [];
    debug.log('Creating 5 clients...');
    for (let i = 0; i < 5; i++) {
        const client = new RWLockWritePrefClient({port});
        await client.ensure();
        client.emitter.on('warning', (msg: any) => debug.warn(`[CLIENT ${i} WARNING]`, msg));
        client.emitter.on('error', (err: any) => debug.error(`[CLIENT ${i} ERROR]`, err));
        clients.push(client);
    }
    debug.log('All clients created');
    
    const tmpFile = createTmpFile();
    const key = 'concurrent-key';
    let writeCount = 0;
    let readCount = 0;
    
    console.log('Using temp file:', tmpFile);
    
    // Mix of reads and writes
    const operations: Promise<void>[] = [];
    debug.log('Creating 20 mixed read/write operations...');
    for (let i = 0; i < 20; i++) {
        const client = clients[i % clients.length];
        const isWrite = Math.random() > 0.5;
        const opId = i;
        
        operations.push(new Promise<void>((resolve, reject) => {
            if (isWrite) {
                writeCount++;
                debug.log(`Operation ${opId}: Requesting write lock...`);
                client.acquireWriteLock(key, {}, (err: any, release: any) => {
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
                        release((releaseErr: any) => {
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
                client.acquireReadLock(key, {}, (err: any, release: any) => {
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
                        release((releaseErr: any) => {
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
    clients.forEach(closeClient);
    await closeBroker(broker);
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    
    return {success: true};
}

interface TestResults {
    rwLock: TestResult | null;
    rwLockWritePref: TestResult | null;
    semaphore: TestResult | null;
    concurrentRW: TestResult | null;
}

async function runAllTests(): Promise<void> {
    console.log('========================================');
    console.log('RW Lock and Semaphore Test Suite');
    console.log('========================================');
    console.log('Node version:', process.version);
    console.log('Platform:', os.platform());
    console.log('========================================\n');
    
    const results: TestResults = {
        rwLock: null,
        rwLockWritePref: null,
        semaphore: null,
        concurrentRW: null
    };
    
    try {
        results.rwLock = await testRWLockWithFile();
        console.log('✅ RW Lock test passed');
    } catch (err: any) {
        console.error('❌ RW Lock test failed:', err);
        results.rwLock = {success: false, error: err.message};
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        results.rwLockWritePref = await testRWLockWritePrefWithFile();
        console.log('✅ RW Lock Write Preferred test passed');
    } catch (err: any) {
        console.error('❌ RW Lock Write Preferred test failed:', err);
        results.rwLockWritePref = {success: false, error: err.message};
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        results.semaphore = await testSemaphoreLogic();
        console.log('✅ Semaphore test passed');
    } catch (err: any) {
        console.error('❌ Semaphore test failed:', err);
        results.semaphore = {success: false, error: err.message};
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        results.concurrentRW = await testConcurrentRWOperations();
        console.log('✅ Concurrent RW operations test passed');
    } catch (err: any) {
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
runAllTests().catch((err: any) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
