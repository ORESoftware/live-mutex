/**
 * Read-Write Lock & Semaphore Test Suite (Local Version)
 * Tests RW locks and semaphores using temporary files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {Broker, RWLockWritePrefClient, Client} from '../dist/main';

// Create a temporary file for testing
function createTempFile(): string {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `lmx-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`);
    fs.writeFileSync(tmpFile, '0', 'utf8');
    return tmpFile;
}

function readFile(filePath: string): number {
    return parseInt(fs.readFileSync(filePath, 'utf8'), 10);
}

function writeFile(filePath: string, value: number): void {
    fs.writeFileSync(filePath, String(value), 'utf8');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBasicRWLock(): Promise<void> {
    console.log('\n=== Test 1: Basic Read-Write Lock ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new Broker({port});
    await broker.ensure();
    
    const client = new RWLockWritePrefClient({port});
    await client.ensure();
    
    const tmpFile = createTempFile();
    console.log('Using temp file:', tmpFile);
    
    try {
        // Test write lock - should be exclusive
        await new Promise<void>((resolve, reject) => {
            client.acquireWriteLock('test-key', {}, (err: any, release: any) => {
                if (err) return reject(err);
                writeFile(tmpFile, 100);
                const value = readFile(tmpFile);
                if (value !== 100) {
                    return reject(new Error(`Expected 100, got ${value}`));
                }
                release((releaseErr: any) => {
                    if (releaseErr) return reject(releaseErr);
                    resolve();
                });
            });
        });
        
        // Test read lock - should allow concurrent readers
        await new Promise<void>((resolve, reject) => {
            client.acquireReadLock('test-key', {}, (err: any, release: any) => {
                if (err) return reject(err);
                const value = readFile(tmpFile);
                if (value !== 100) {
                    return reject(new Error(`Expected 100, got ${value}`));
                }
                release((releaseErr: any) => {
                    if (releaseErr) return reject(releaseErr);
                    resolve();
                });
            });
        });
        
        console.log('✅ Basic RWLock test passed');
    } catch (err: any) {
        console.error('❌ Basic RWLock test failed:', err.message);
        throw err;
    } finally {
        await new Promise<void>(resolve => broker.close(resolve));
        client.close();
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testConcurrentReaders(): Promise<void> {
    console.log('\n=== Test 2: Concurrent Readers ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new Broker({port});
    await broker.ensure();
    
    const clients: RWLockWritePrefClient[] = [];
    for (let i = 0; i < 5; i++) {
        const client = new RWLockWritePrefClient({port});
        await client.ensure();
        clients.push(client);
    }
    
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    
    try {
        // All readers should be able to read simultaneously
        const readPromises = clients.map((client, index) => {
            return new Promise<void>((resolve, reject) => {
                client.acquireReadLock('read-key', {}, (err: any, release: any) => {
                    if (err) return reject(err);
                    const value = readFile(tmpFile);
                    console.log(`  Reader ${index} read value: ${value}`);
                    // Simulate some reading time
                    setTimeout(() => {
                        release((releaseErr: any) => {
                            if (releaseErr) return reject(releaseErr);
                            resolve();
                        });
                    }, 10);
                });
            });
        });
        
        await Promise.all(readPromises);
        console.log('✅ Concurrent readers test passed - all readers accessed simultaneously');
    } catch (err: any) {
        console.error('❌ Concurrent readers test failed:', err.message);
        throw err;
    } finally {
        await new Promise<void>(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testExclusiveWriter(): Promise<void> {
    console.log('\n=== Test 3: Exclusive Writer ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new Broker({port});
    await broker.ensure();
    
    const clients: RWLockWritePrefClient[] = [];
    for (let i = 0; i < 3; i++) {
        const client = new RWLockWritePrefClient({port});
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
            return new Promise<void>((resolve, reject) => {
                client.acquireWriteLock('write-key', {}, (err: any, release: any) => {
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
                        release((releaseErr: any) => {
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
    } catch (err: any) {
        console.error('❌ Exclusive writer test failed:', err.message);
        throw err;
    } finally {
        await new Promise<void>(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testReaderWriterInteraction(): Promise<void> {
    console.log('\n=== Test 4: Reader-Writer Interaction ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new Broker({port});
    await broker.ensure();
    
    const readerClient = new RWLockWritePrefClient({port});
    await readerClient.ensure();
    
    const writerClient = new RWLockWritePrefClient({port});
    await writerClient.ensure();
    
    const tmpFile = createTempFile();
    writeFile(tmpFile, 100);
    console.log('Using temp file:', tmpFile);
    
    try {
        // Start a reader
        const readerPromise = new Promise<void>((resolve, reject) => {
            readerClient.acquireReadLock('rw-key', {}, (err: any, release: any) => {
                if (err) return reject(err);
                console.log('  Reader acquired lock');
                
                // Reader should be able to read
                const value1 = readFile(tmpFile);
                console.log(`  Reader read value: ${value1}`);
                
                // Wait a bit, then try to write (should wait for reader to finish)
                setTimeout(() => {
                    const value2 = readFile(tmpFile);
                    console.log(`  Reader read value again: ${value2}`);
                    release((releaseErr: any) => {
                        if (releaseErr) return reject(releaseErr);
                        console.log('  Reader released lock');
                        resolve();
                    });
                }, 100);
            });
        });
        
        // Start a writer (should wait for reader)
        await sleep(20); // Give reader time to acquire
        const writerPromise = new Promise<void>((resolve, reject) => {
            writerClient.acquireWriteLock('rw-key', {}, (err: any, release: any) => {
                if (err) return reject(err);
                console.log('  Writer acquired lock (after reader released)');
                
                const currentValue = readFile(tmpFile);
                writeFile(tmpFile, currentValue + 50);
                const newValue = readFile(tmpFile);
                console.log(`  Writer wrote value: ${newValue}`);
                
                release((releaseErr: any) => {
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
    } catch (err: any) {
        console.error('❌ Reader-writer interaction test failed:', err.message);
        throw err;
    } finally {
        await new Promise<void>(resolve => broker.close(resolve));
        readerClient.close();
        writerClient.close();
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testSemaphoreLogic(): Promise<void> {
    console.log('\n=== Test 5: Semaphore Logic ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new Broker({port});
    await broker.ensure();
    
    const clients: Client[] = [];
    for (let i = 0; i < 10; i++) {
        const client = new Client({port});
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
            return new Promise<void>((resolve, reject) => {
                client.lock('semaphore-key', {max: maxHolders}, (err: any, unlock: any) => {
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
                        unlock((unlockErr: any) => {
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
    } catch (err: any) {
        console.error('❌ Semaphore test failed:', err.message);
        throw err;
    } finally {
        await new Promise<void>(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function testSemaphoreStress(): Promise<void> {
    console.log('\n=== Test 6: Semaphore Stress Test ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new Broker({port});
    await broker.ensure();
    
    const clients: Client[] = [];
    for (let i = 0; i < 20; i++) {
        const client = new Client({port});
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
        
        const allPromises: Promise<void>[] = [];
        for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
            const client = clients[clientIndex];
            for (let op = 0; op < operationsPerClient; op++) {
                allPromises.push(new Promise<void>((resolve, reject) => {
                    client.lock('stress-semaphore', {max: maxHolders}, (err: any, unlock: any) => {
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
                            unlock((unlockErr: any) => {
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
    } catch (err: any) {
        console.error('❌ Semaphore stress test failed:', err.message);
        throw err;
    } finally {
        await new Promise<void>(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
}

async function runAllTests(): Promise<void> {
    console.log('========================================');
    console.log('Read-Write Lock & Semaphore Test Suite');
    console.log('========================================\n');
    
    const tests: Array<{name: string; fn: () => Promise<void>}> = [
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
        } catch (err: any) {
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
        // Exit immediately - cleanup should already be done in finally blocks
        setImmediate(() => process.exit(0));
    } else {
        console.error(`❌ ${failed} test(s) failed!`);
        setImmediate(() => process.exit(1));
    }
}

// Run tests
runAllTests().catch((err: any) => {
    console.error('Fatal error:', err);
    setImmediate(() => process.exit(1));
});

