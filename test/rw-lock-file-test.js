#!/usr/bin/env node
'use strict';

<<<<<<< HEAD
const {Broker, RWLockWritePrefClient} = require('../dist/main');
=======
/**
 * Reader-Writer Lock File Test
 * Tests RW locks by reading/writing to a file to verify correct ordering
 * Uses extensive debug logging to track operation order
 */

>>>>>>> 3308d56eb6e299a03ffba0c8819080854180e5e9
const fs = require('fs');
const path = require('path');
const { Broker1 } = require('../dist/broker-1');
const { RWLockWritePrefClient } = require('../dist/rw-write-preferred-client');

<<<<<<< HEAD
// Create a temporary file for testing
function createTempFile() {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `lmx-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`);
    fs.writeFileSync(tmpFile, '0', 'utf8');
    return tmpFile;
}

function readFile(filePath) {
    return parseInt(fs.readFileSync(filePath, 'utf8'), 10);
}

function writeFile(filePath, value) {
    fs.writeFileSync(filePath, String(value), 'utf8');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBasicRWLock() {
    console.log('\n=== Test 1: Basic Read-Write Lock ===');
    const broker = new Broker({port: 6976});
    await broker.ensure();
    
    const client = new RWLockWritePrefClient({port: 6976});
    await client.ensure();
    
    const tmpFile = createTempFile();
    console.log('Using temp file:', tmpFile);
    
    try {
        // Test write lock - should be exclusive
        await new Promise((resolve, reject) => {
            client.acquireWriteLock('test-key', {}, (err, release) => {
                if (err) return reject(err);
                writeFile(tmpFile, 100);
                const value = readFile(tmpFile);
                if (value !== 100) {
                    return reject(new Error(`Expected 100, got ${value}`));
                }
                release((releaseErr) => {
                    if (releaseErr) return reject(releaseErr);
                    resolve();
                });
            });
        });
        
        // Test read lock - should allow concurrent readers
        await new Promise((resolve, reject) => {
            client.acquireReadLock('test-key', {}, (err, release) => {
                if (err) return reject(err);
                const value = readFile(tmpFile);
                if (value !== 100) {
                    return reject(new Error(`Expected 100, got ${value}`));
                }
                release((releaseErr) => {
                    if (releaseErr) return reject(releaseErr);
                    resolve();
                });
            });
        });
        
        console.log('✅ Basic RWLock test passed');
    } catch (err) {
        console.error('❌ Basic RWLock test failed:', err.message);
        throw err;
    } finally {
        await new Promise(resolve => broker.close(resolve));
        client.close();
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testConcurrentReaders() {
    console.log('\n=== Test 2: Concurrent Readers ===');
    const broker = new Broker({port: 6977});
    await broker.ensure();
    
    const clients = [];
    for (let i = 0; i < 5; i++) {
        const client = new RWLockWritePrefClient({port: 6977});
        await client.ensure();
        clients.push(client);
    }
    
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    
    try {
        // All readers should be able to read simultaneously
        const readPromises = clients.map((client, index) => {
            return new Promise((resolve, reject) => {
                client.acquireReadLock('read-key', {}, (err, release) => {
                    if (err) return reject(err);
                    const value = readFile(tmpFile);
                    console.log(`  Reader ${index} read value: ${value}`);
                    // Simulate some reading time
                    setTimeout(() => {
                        release((releaseErr) => {
                            if (releaseErr) return reject(releaseErr);
                            resolve();
                        });
                    }, 10);
                });
            });
        });
        
        await Promise.all(readPromises);
        console.log('✅ Concurrent readers test passed - all readers accessed simultaneously');
    } catch (err) {
        console.error('❌ Concurrent readers test failed:', err.message);
        throw err;
    } finally {
        await new Promise(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testExclusiveWriter() {
    console.log('\n=== Test 3: Exclusive Writer ===');
    const broker = new Broker({port: 6978});
    await broker.ensure();
    
    const clients = [];
    for (let i = 0; i < 3; i++) {
        const client = new RWLockWritePrefClient({port: 6978});
        await client.ensure();
        clients.push(client);
    }
    
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    
    try {
        // Writers should be exclusive - only one at a time
        let writeCount = 0;
        const writePromises = clients.map((client, index) => {
            return new Promise((resolve, reject) => {
                client.acquireWriteLock('write-key', {}, (err, release) => {
                    if (err) return reject(err);
                    
                    writeCount++;
                    if (writeCount > 1) {
                        return reject(new Error(`Multiple writers detected! Count: ${writeCount}`));
                    }
                    
                    const currentValue = readFile(tmpFile);
                    const newValue = currentValue + 1;
                    writeFile(tmpFile, newValue);
                    console.log(`  Writer ${index} wrote value: ${newValue}`);
                    
                    // Simulate some writing time
                    setTimeout(() => {
                        writeCount--;
                        release((releaseErr) => {
                            if (releaseErr) return reject(releaseErr);
                            resolve();
                        });
                    }, 50);
                });
            });
        });
        
        await Promise.all(writePromises);
        const finalValue = readFile(tmpFile);
        if (finalValue !== 3) {
            throw new Error(`Expected final value 3, got ${finalValue}`);
        }
        console.log('✅ Exclusive writer test passed - writers were exclusive');
    } catch (err) {
        console.error('❌ Exclusive writer test failed:', err.message);
        throw err;
    } finally {
        await new Promise(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testReaderWriterInteraction() {
    console.log('\n=== Test 4: Reader-Writer Interaction ===');
    const broker = new Broker({port: 6979});
    await broker.ensure();
    
    const readerClient = new RWLockWritePrefClient({port: 6979});
    await readerClient.ensure();
    
    const writerClient = new RWLockWritePrefClient({port: 6979});
    await writerClient.ensure();
    
    const tmpFile = createTempFile();
    writeFile(tmpFile, 100);
    console.log('Using temp file:', tmpFile);
    
    try {
        // Start a reader
        const readerPromise = new Promise((resolve, reject) => {
            readerClient.acquireReadLock('rw-key', {}, (err, release) => {
                if (err) return reject(err);
                console.log('  Reader acquired lock');
                
                // Reader should be able to read
                const value1 = readFile(tmpFile);
                console.log(`  Reader read value: ${value1}`);
                
                // Wait a bit, then try to write (should wait for reader to finish)
                setTimeout(() => {
                    const value2 = readFile(tmpFile);
                    console.log(`  Reader read value again: ${value2}`);
                    release((releaseErr) => {
                        if (releaseErr) return reject(releaseErr);
                        console.log('  Reader released lock');
                        resolve();
                    });
                }, 100);
            });
        });
        
        // Start a writer (should wait for reader)
        await sleep(20); // Give reader time to acquire
        const writerPromise = new Promise((resolve, reject) => {
            writerClient.acquireWriteLock('rw-key', {}, (err, release) => {
                if (err) return reject(err);
                console.log('  Writer acquired lock (after reader released)');
                
                const currentValue = readFile(tmpFile);
                writeFile(tmpFile, currentValue + 50);
                const newValue = readFile(tmpFile);
                console.log(`  Writer wrote value: ${newValue}`);
                
                release((releaseErr) => {
                    if (releaseErr) return reject(releaseErr);
                    console.log('  Writer released lock');
                    resolve();
                });
            });
        });
        
        await Promise.all([readerPromise, writerPromise]);
        
        const finalValue = readFile(tmpFile);
        if (finalValue !== 150) {
            throw new Error(`Expected final value 150, got ${finalValue}`);
        }
        console.log('✅ Reader-writer interaction test passed');
    } catch (err) {
        console.error('❌ Reader-writer interaction test failed:', err.message);
        throw err;
    } finally {
        await new Promise(resolve => broker.close(resolve));
        readerClient.close();
        writerClient.close();
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testSemaphoreLogic() {
    console.log('\n=== Test 5: Semaphore Logic ===');
    const broker = new Broker({port: 6980});
    await broker.ensure();
    
    const {Client} = require('../dist/main');
    const clients = [];
    for (let i = 0; i < 10; i++) {
        const client = new Client({port: 6980});
        await client.ensure();
        clients.push(client);
    }
    
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    console.log('Testing semaphore with max=3 (should allow 3 concurrent holders)');
    
    try {
        let concurrentCount = 0;
        let maxConcurrent = 0;
        const maxHolders = 3;
        
        const semaphorePromises = clients.map((client, index) => {
            return new Promise((resolve, reject) => {
                client.lock('semaphore-key', {max: maxHolders}, (err, unlock) => {
                    if (err) return reject(err);
                    
                    concurrentCount++;
                    maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                    
                    if (concurrentCount > maxHolders) {
                        return reject(new Error(`Semaphore limit exceeded! Count: ${concurrentCount}, Max: ${maxHolders}`));
                    }
                    
                    console.log(`  Client ${index} acquired semaphore (concurrent: ${concurrentCount})`);
                    
                    // Increment file value
                    const currentValue = readFile(tmpFile);
                    writeFile(tmpFile, currentValue + 1);
                    
                    // Simulate work
                    setTimeout(() => {
                        concurrentCount--;
                        unlock((unlockErr) => {
                            if (unlockErr) return reject(unlockErr);
                            console.log(`  Client ${index} released semaphore (concurrent: ${concurrentCount})`);
                            resolve();
                        });
                    }, 50 + Math.random() * 50);
                });
            });
        });
        
        await Promise.all(semaphorePromises);
        
        const finalValue = readFile(tmpFile);
        if (finalValue !== 10) {
            throw new Error(`Expected final value 10, got ${finalValue}`);
        }
        
        if (maxConcurrent > maxHolders) {
            throw new Error(`Max concurrent exceeded limit! Max concurrent: ${maxConcurrent}, Limit: ${maxHolders}`);
        }
        
        if (maxConcurrent < 1) {
            throw new Error(`No concurrent access detected! Max concurrent: ${maxConcurrent}`);
        }
        
        console.log(`✅ Semaphore test passed - Max concurrent: ${maxConcurrent}, Limit: ${maxHolders}`);
        console.log(`   Final file value: ${finalValue} (expected: 10)`);
    } catch (err) {
        console.error('❌ Semaphore test failed:', err.message);
        throw err;
    } finally {
        await new Promise(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testSemaphoreStress() {
    console.log('\n=== Test 6: Semaphore Stress Test ===');
    const broker = new Broker({port: 6981});
    await broker.ensure();
    
    const {Client} = require('../dist/main');
    const clients = [];
    for (let i = 0; i < 20; i++) {
        const client = new Client({port: 6981});
        await client.ensure();
        clients.push(client);
    }
    
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    console.log('Stress testing semaphore with max=5, 20 clients, 100 operations each');
    
    try {
        const maxHolders = 5;
        let concurrentCount = 0;
        let maxConcurrent = 0;
        let totalOperations = 0;
        const operationsPerClient = 100;
        
        const allPromises = [];
        for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
            const client = clients[clientIndex];
            for (let op = 0; op < operationsPerClient; op++) {
                allPromises.push(new Promise((resolve, reject) => {
                    client.lock('stress-semaphore', {max: maxHolders}, (err, unlock) => {
                        if (err) return reject(err);
                        
                        concurrentCount++;
                        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                        
                        if (concurrentCount > maxHolders) {
                            return reject(new Error(`Semaphore limit exceeded! Count: ${concurrentCount}, Max: ${maxHolders}`));
                        }
                        
                        totalOperations++;
                        
                        // Increment file value
                        const currentValue = readFile(tmpFile);
                        writeFile(tmpFile, currentValue + 1);
                        
                        // Simulate work
                        setTimeout(() => {
                            concurrentCount--;
                            unlock((unlockErr) => {
                                if (unlockErr) return reject(unlockErr);
                                resolve();
                            });
                        }, Math.random() * 10);
                    });
                }));
            }
        }
        
        await Promise.all(allPromises);
        
        const finalValue = readFile(tmpFile);
        const expectedValue = clients.length * operationsPerClient;
        
        if (finalValue !== expectedValue) {
            throw new Error(`Expected final value ${expectedValue}, got ${finalValue}`);
        }
        
        if (maxConcurrent > maxHolders) {
            throw new Error(`Max concurrent exceeded limit! Max concurrent: ${maxConcurrent}, Limit: ${maxHolders}`);
        }
        
        console.log(`✅ Semaphore stress test passed`);
        console.log(`   Total operations: ${totalOperations}`);
        console.log(`   Max concurrent: ${maxConcurrent} (limit: ${maxHolders})`);
        console.log(`   Final file value: ${finalValue} (expected: ${expectedValue})`);
    } catch (err) {
        console.error('❌ Semaphore stress test failed:', err.message);
        throw err;
    } finally {
        await new Promise(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function runAllTests() {
    console.log('========================================');
    console.log('Read-Write Lock & Semaphore Test Suite');
    console.log('========================================\n');
    
    const tests = [
        {name: 'Basic RWLock', fn: testBasicRWLock},
        {name: 'Concurrent Readers', fn: testConcurrentReaders},
        {name: 'Exclusive Writer', fn: testExclusiveWriter},
        {name: 'Reader-Writer Interaction', fn: testReaderWriterInteraction},
        {name: 'Semaphore Logic', fn: testSemaphoreLogic},
        {name: 'Semaphore Stress', fn: testSemaphoreStress}
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            await test.fn();
            passed++;
            await sleep(500); // Brief pause between tests
        } catch (err) {
            failed++;
            console.error(`\nTest "${test.name}" failed:`, err);
        }
    }
    
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`Passed: ${passed}/${tests.length}`);
    console.log(`Failed: ${failed}/${tests.length}`);
    console.log('========================================\n');
    
    if (failed === 0) {
        console.log('✅ All tests passed!');
        process.exit(0);
    } else {
        console.error(`❌ ${failed} test(s) failed!`);
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
=======
const PORT = 4444;
const TEST_FILE = path.join(require('os').tmpdir(), 'lmx-rw-test.txt');
const LOG_FILE = path.join(require('os').tmpdir(), 'lmx-rw-test.log');

// Debug logging
const debugLog = [];
let logCounter = 0;

function debug(message, data = {}) {
    const timestamp = Date.now();
    const entry = {
        id: ++logCounter,
        timestamp,
        time: new Date().toISOString(),
        message,
        ...data
    };
    debugLog.push(entry);
    const logLine = `[${entry.time}] [${entry.id}] ${message}${Object.keys(data).length > 0 ? ' ' + JSON.stringify(data) : ''}`;
    console.log(logLine);
    
    // Also write to log file
    try {
        fs.appendFileSync(LOG_FILE, logLine + '\n');
    } catch (err) {
        // Ignore log file errors
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readFile() {
    try {
        const content = fs.readFileSync(TEST_FILE, 'utf8');
        return content.trim();
    } catch (err) {
        if (err.code === 'ENOENT') {
            return '';
        }
        throw err;
    }
}

function writeFile(content) {
    fs.writeFileSync(TEST_FILE, content, 'utf8');
}

function appendToFile(content) {
    fs.appendFileSync(TEST_FILE, content, 'utf8');
}

async function readerOperation(client, readerId, key, expectedValue) {
    debug(`Reader ${readerId} starting`, { readerId, key, expectedValue });
    
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        client.acquireReadLock(key, {}, (err, release) => {
            const acquireTime = Date.now() - startTime;
            
            if (err) {
                debug(`Reader ${readerId} failed to acquire lock`, { readerId, error: err.message });
                return reject(err);
            }
            
            debug(`Reader ${readerId} acquired read lock`, { 
                readerId, 
                acquireTime: `${acquireTime}ms`,
                timestamp: Date.now()
            });
            
            // Read the file
            const readStart = Date.now();
            const content = readFile();
            const readTime = Date.now() - readStart;
            
            debug(`Reader ${readerId} read file`, { 
                readerId, 
                content, 
                readTime: `${readTime}ms`,
                expectedValue,
                matches: content === expectedValue
            });
            
            // Verify we got expected value (or at least a valid value)
            if (expectedValue && content !== expectedValue && content !== '') {
                debug(`⚠️  Reader ${readerId} got unexpected value`, { 
                    readerId, 
                    expected: expectedValue, 
                    actual: content 
                });
            }
            
            // Hold lock for a bit to simulate work
            setTimeout(() => {
                release((releaseErr) => {
                    const releaseTime = Date.now() - startTime;
                    if (releaseErr) {
                        debug(`Reader ${readerId} failed to release lock`, { readerId, error: releaseErr.message });
                        return reject(releaseErr);
                    }
                    
                    debug(`Reader ${readerId} released read lock`, { 
                        readerId, 
                        totalTime: `${releaseTime}ms`,
                        contentRead: content
                    });
                    resolve({ readerId, content, totalTime: releaseTime });
                });
            }, 50 + Math.random() * 100);
        });
    });
}

async function writerOperation(client, writerId, key, writeValue, expectedBefore) {
    debug(`Writer ${writerId} starting`, { writerId, key, writeValue, expectedBefore });
    
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        client.acquireWriteLock(key, {}, (err, release) => {
            const acquireTime = Date.now() - startTime;
            
            if (err) {
                debug(`Writer ${writerId} failed to acquire lock`, { writerId, error: err.message });
                return reject(err);
            }
            
            debug(`Writer ${writerId} acquired write lock`, { 
                writerId, 
                acquireTime: `${acquireTime}ms`,
                timestamp: Date.now()
            });
            
            // Read current value
            const currentValue = readFile();
            debug(`Writer ${writerId} read current value before write`, { 
                writerId, 
                currentValue, 
                expectedBefore,
                matches: currentValue === expectedBefore
            });
            
            if (expectedBefore && currentValue !== expectedBefore) {
                debug(`⚠️  Writer ${writerId} saw unexpected value before write`, { 
                    writerId, 
                    expected: expectedBefore, 
                    actual: currentValue 
                });
            }
            
            // Write new value
            const writeStart = Date.now();
            writeFile(writeValue);
            const writeTime = Date.now() - writeStart;
            
            debug(`Writer ${writerId} wrote file`, { 
                writerId, 
                writeValue, 
                writeTime: `${writeTime}ms`,
                previousValue: currentValue
            });
            
            // Verify write succeeded
            const verifyValue = readFile();
            if (verifyValue !== writeValue) {
                debug(`⚠️  Writer ${writerId} write verification failed`, { 
                    writerId, 
                    expected: writeValue, 
                    actual: verifyValue 
                });
            }
            
            // Hold lock for a bit
            setTimeout(() => {
                release((releaseErr) => {
                    const releaseTime = Date.now() - startTime;
                    if (releaseErr) {
                        debug(`Writer ${writerId} failed to release lock`, { writerId, error: releaseErr.message });
                        return reject(releaseErr);
                    }
                    
                    debug(`Writer ${writerId} released write lock`, { 
                        writerId, 
                        totalTime: `${releaseTime}ms`,
                        valueWritten: writeValue
                    });
                    resolve({ writerId, valueWritten: writeValue, totalTime: releaseTime });
                });
            }, 50 + Math.random() * 100);
        });
    });
}

async function runRWLockFileTest() {
    console.log('=== Reader-Writer Lock File Test ===\n');
    console.log(`Test file: ${TEST_FILE}`);
    console.log(`Log file: ${LOG_FILE}\n`);
    
    // Clean up old files
    try {
        if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
        if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
    } catch (err) {
        // Ignore
    }
    
    let broker = null;
    const clients = [];
    
    try {
        debug('Starting broker', { port: PORT });
        broker = new Broker1({ port: PORT });
        await broker.ensure();
        debug('Broker started');
        
        // Create clients
        debug('Creating RW lock clients', { count: 5 });
        for (let i = 0; i < 5; i++) {
            const client = new RWLockWritePrefClient({ port: PORT });
            await client.ensure();
            clients.push(client);
        }
        debug('All clients created', { clientCount: clients.length });
        
        // Initialize file
        writeFile('INIT');
        debug('File initialized', { value: 'INIT' });
        
        // Test 1: Multiple readers should be able to read simultaneously
        debug('\n=== Test 1: Multiple Concurrent Readers ===');
        const readers1 = [];
        for (let i = 0; i < 3; i++) {
            readers1.push(readerOperation(clients[i], `R1-${i}`, 'test-key', 'INIT'));
        }
        const readerResults1 = await Promise.all(readers1);
        debug('Test 1 completed', { 
            readers: readerResults1.length,
            allReadSame: readerResults1.every(r => r.content === 'INIT')
        });
        
        await delay(100);
        
        // Test 2: Writer should be exclusive (no readers during write)
        debug('\n=== Test 2: Writer Exclusive Access ===');
        const writer1 = writerOperation(clients[0], 'W1', 'test-key', 'WRITE-1', 'INIT');
        const readers2 = [];
        // Start readers while writer is active
        for (let i = 0; i < 2; i++) {
            setTimeout(() => {
                readers2.push(readerOperation(clients[i + 1], `R2-${i}`, 'test-key', 'WRITE-1'));
            }, 20 + i * 30);
        }
        
        const [writerResult1] = await Promise.all([writer1, ...readers2]);
        debug('Test 2 completed', { 
            writer: writerResult1.valueWritten,
            readers: readers2.length
        });
        
        await delay(100);
        
        // Test 3: Sequential writes should maintain order
        debug('\n=== Test 3: Sequential Writes ===');
        const write1 = writerOperation(clients[0], 'W2', 'test-key', 'WRITE-2', 'WRITE-1');
        const write2 = writerOperation(clients[1], 'W3', 'test-key', 'WRITE-3', 'WRITE-2');
        const write3 = writerOperation(clients[2], 'W4', 'test-key', 'WRITE-4', 'WRITE-3');
        
        const [w1, w2, w3] = await Promise.all([write1, write2, write3]);
        const finalValue = readFile();
        debug('Test 3 completed', { 
            writes: [w1.valueWritten, w2.valueWritten, w3.valueWritten],
            finalValue,
            correct: finalValue === 'WRITE-4'
        });
        
        await delay(100);
        
        // Test 4: Mixed readers and writers
        debug('\n=== Test 4: Mixed Readers and Writers ===');
        writeFile('MIXED-START');
        
        const mixedOps = [];
        // Start with a writer
        mixedOps.push(writerOperation(clients[0], 'WM1', 'test-key', 'MIXED-1', 'MIXED-START'));
        
        // Add readers that should wait for writer
        setTimeout(() => {
            for (let i = 0; i < 3; i++) {
                mixedOps.push(readerOperation(clients[i + 1], `RM-${i}`, 'test-key', 'MIXED-1'));
            }
        }, 30);
        
        // Add another writer that should wait
        setTimeout(() => {
            mixedOps.push(writerOperation(clients[4], 'WM2', 'test-key', 'MIXED-2', 'MIXED-1'));
        }, 60);
        
        await Promise.all(mixedOps);
        const mixedFinal = readFile();
        debug('Test 4 completed', { 
            finalValue: mixedFinal,
            correct: mixedFinal === 'MIXED-2'
        });
        
        await delay(100);
        
        // Test 5: Stress test - many concurrent operations
        debug('\n=== Test 5: Stress Test - Many Concurrent Operations ===');
        writeFile('STRESS-0');
        let currentValue = 0;
        
        const stressOps = [];
        const stressStart = Date.now();
        
        // Create 20 operations: 10 writers, 10 readers
        for (let i = 0; i < 20; i++) {
            const client = clients[i % clients.length];
            const delayMs = i * 10; // Stagger starts
            
            setTimeout(() => {
                if (i % 2 === 0) {
                    // Writer
                    currentValue++;
                    const value = `STRESS-${currentValue}`;
                    stressOps.push(writerOperation(client, `WS-${i}`, 'test-key', value, null));
                } else {
                    // Reader
                    stressOps.push(readerOperation(client, `RS-${i}`, 'test-key', null));
                }
            }, delayMs);
        }
        
        await Promise.all(stressOps);
        const stressTime = Date.now() - stressStart;
        const stressFinal = readFile();
        debug('Test 5 completed', { 
            operations: stressOps.length,
            duration: `${stressTime}ms`,
            finalValue: stressFinal,
            expectedValue: `STRESS-${currentValue}`
        });
        
        // Analyze results
        debug('\n=== Analysis ===');
        const operations = debugLog.filter(e => 
            e.message.includes('acquired') || 
            e.message.includes('released') ||
            e.message.includes('wrote') ||
            e.message.includes('read file')
        );
        
        debug('Operation timeline', { 
            totalOperations: operations.length,
            sample: operations.slice(0, 10).map(e => ({
                time: e.time,
                message: e.message
            }))
        });
        
        // Check for violations
        let violations = [];
        let currentWriter = null;
        let activeReaders = new Set();
        
        for (const op of operations) {
            if (op.message.includes('acquired write lock')) {
                if (activeReaders.size > 0) {
                    violations.push(`Writer ${op.writerId} acquired while ${activeReaders.size} readers active`);
                }
                if (currentWriter) {
                    violations.push(`Writer ${op.writerId} acquired while writer ${currentWriter} active`);
                }
                currentWriter = op.writerId;
            } else if (op.message.includes('acquired read lock')) {
                if (currentWriter) {
                    violations.push(`Reader ${op.readerId} acquired while writer ${currentWriter} active`);
                }
                activeReaders.add(op.readerId);
            } else if (op.message.includes('released write lock')) {
                currentWriter = null;
            } else if (op.message.includes('released read lock')) {
                activeReaders.delete(op.readerId);
            }
        }
        
        if (violations.length > 0) {
            debug('⚠️  VIOLATIONS DETECTED', { violations });
            console.log('\n❌ Test FAILED: Lock violations detected!');
            violations.forEach(v => console.log(`  - ${v}`));
        } else {
            debug('✓ No violations detected', {});
            console.log('\n✅ Test PASSED: All operations followed correct ordering!');
        }
        
        // Final file state
        const finalContent = readFile();
        debug('Final file state', { content: finalContent });
        
        console.log(`\n=== Test Complete ===`);
        console.log(`Log file: ${LOG_FILE}`);
        console.log(`Total log entries: ${debugLog.length}`);
        
    } catch (error) {
        debug('Test failed with error', { error: error.message, stack: error.stack });
        console.error('\n❌ Test failed:', error);
        throw error;
    } finally {
        // Cleanup
        debug('Cleaning up', {});
        for (const client of clients) {
            try {
                client.close();
            } catch (err) {
                // Ignore
            }
        }
        
        if (broker) {
            await new Promise((resolve) => {
                broker.close(() => resolve());
            });
        }
        
        debug('Cleanup complete', {});
    }
}

// Run the test
runRWLockFileTest()
    .then(() => {
        console.log('\n✅ All tests completed');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Test suite failed:', err);
        process.exit(1);
    });

>>>>>>> 3308d56eb6e299a03ffba0c8819080854180e5e9
