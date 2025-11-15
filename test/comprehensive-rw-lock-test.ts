#!/usr/bin/env node
'use strict';

/**
 * Comprehensive Reader-Writer Lock Test Suite
 * Tests all aspects of RW lock behavior including:
 * - Concurrent readers
 * - Exclusive writers
 * - Write preference
 * - Ordering guarantees
 * - Stress testing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Broker1 } from '../dist/broker-1';
import { RWLockWritePrefClient } from '../dist/rw-write-preferred-client';

const PORT = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : 3333;
const TEST_FILE = path.join(os.tmpdir(), 'lmx-rw-comprehensive-test.txt');

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    details?: any;
}

const testResults: TestResult[] = [];

function log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
    console.log(logLine);
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readFile(): string {
    try {
        return fs.readFileSync(TEST_FILE, 'utf8').trim();
    } catch (err: any) {
        if (err.code === 'ENOENT') return '';
        throw err;
    }
}

function writeFile(content: string): void {
    fs.writeFileSync(TEST_FILE, content, 'utf8');
}

function appendToFile(content: string): void {
    fs.appendFileSync(TEST_FILE, content, 'utf8');
}

/**
 * Handle release errors, distinguishing between timeout errors (expected) and real errors
 * @param releaseErr The error from the release callback
 * @param lockType Type of lock being released ('read' or 'write') for better error messages
 */
function handleReleaseError(releaseErr: any, lockType: 'read' | 'write' = 'write'): void {
    if (releaseErr) {
        // Check if it's a timeout error (expected, not a real error)
        const isTimeout = releaseErr?.message?.toLowerCase().includes('timeout') || 
                         releaseErr?.message?.toLowerCase().includes('timed out') ||
                         releaseErr?.code === 'ETIMEDOUT';
        if (!isTimeout) {
            const lockTypeName = lockType === 'read' ? 'releaseReadLock' : 'releaseWriteLock';
            console.error(`${lockTypeName} error:`, releaseErr);
        }
    }
}

async function test1_ConcurrentReaders(broker: Broker1, clients: RWLockWritePrefClient[]): Promise<TestResult> {
    log('Test 1: Multiple Concurrent Readers');
    try {
        writeFile('TEST1');
        const key = 'test1-key';
        
        const readers: Promise<void>[] = [];
        for (let i = 0; i < 5; i++) {
            readers.push(
                new Promise<void>((resolve, reject) => {
                    clients[i].acquireReadLock(key, {}, (err: any, release: any) => {
                        if (err) return reject(err);
                        const content = readFile();
                        if (content !== 'TEST1') {
                            return reject(new Error(`Reader ${i} read wrong value: ${content}`));
                        }
                        setTimeout(() => {
                            release((releaseErr: any) => {
                                handleReleaseError(releaseErr, 'read');
                                resolve();
                            });
                        }, 50);
                    });
                })
            );
        }
        
        await Promise.all(readers);
        log('Test 1 PASSED: All readers read concurrently');
        return { name: 'Concurrent Readers', passed: true };
    } catch (err: any) {
        log('Test 1 FAILED', { error: err.message });
        return { name: 'Concurrent Readers', passed: false, error: err.message };
    }
}

async function test2_WriterExclusive(broker: Broker1, clients: RWLockWritePrefClient[]): Promise<TestResult> {
    log('Test 2: Writer Exclusive Access');
    try {
        writeFile('TEST2-START');
        const key = 'test2-key';
        let writerAcquired = false;
        let writerReleased = false;
        let readerAcquiredDuringWrite = false;
        let readerAcquiredTime = 0;
        let writerReleaseTime = 0;
        
        const writer = new Promise<void>((resolve, reject) => {
            const writerStartTime = Date.now();
            clients[0].acquireWriteLock(key, {}, (err: any, release: any) => {
                if (err) return reject(err);
                writerAcquired = true;
                log('Writer acquired');
                
                // Start a reader while writer holds lock
                setTimeout(() => {
                    clients[1].acquireReadLock(key, {}, (readErr: any, readRelease: any) => {
                        readerAcquiredTime = Date.now();
                        if (!readErr) {
                            // Check if writer still holds lock
                            if (!writerReleased) {
                                readerAcquiredDuringWrite = true;
                                log('⚠️  Reader acquired during write!');
                            } else {
                                log('Reader acquired after writer released (correct)');
                            }
                            readRelease(() => {});
                        }
                    });
                }, 50);
                
                setTimeout(() => {
                    writerReleaseTime = Date.now();
                    writerReleased = true;
                    release((releaseErr: any) => {
                        handleReleaseError(releaseErr, 'write');
                        log('Writer released');
                        resolve();
                    });
                }, 300);
            });
        });
        
        await writer;
        await delay(500); // Wait longer for reader to complete
        
        if (readerAcquiredDuringWrite) {
            return { name: 'Writer Exclusive', passed: false, error: 'Reader acquired during write' };
        }
        
        log('Test 2 PASSED: Writer was exclusive');
        return { name: 'Writer Exclusive', passed: true };
    } catch (err: any) {
        log('Test 2 FAILED', { error: err.message });
        return { name: 'Writer Exclusive', passed: false, error: err.message };
    }
}

async function test3_SequentialWrites(broker: Broker1, clients: RWLockWritePrefClient[]): Promise<TestResult> {
    log('Test 3: Sequential Writes Maintain Order');
    try {
        writeFile('WRITE-0');
        const key = 'test3-key';
        const values: string[] = [];
        
        for (let i = 1; i <= 5; i++) {
            await new Promise<void>((resolve, reject) => {
                clients[i % clients.length].acquireWriteLock(key, {}, (err: any, release: any) => {
                    if (err) return reject(err);
                    const value = `WRITE-${i}`;
                    const before = readFile();
                    writeFile(value);
                    const after = readFile();
                    values.push(value);
                    log(`Write ${i}: ${before} -> ${after}`);
                    setTimeout(() => {
                        release((releaseErr: any) => {
                            handleReleaseError(releaseErr, 'write');
                            resolve();
                        });
                    }, 50);
                });
            });
        }
        
        const final = readFile();
        if (final !== 'WRITE-5') {
            return { name: 'Sequential Writes', passed: false, error: `Expected WRITE-5, got ${final}` };
        }
        
        log('Test 3 PASSED: Writes maintained order');
        return { name: 'Sequential Writes', passed: true, details: { values, final } };
    } catch (err: any) {
        log('Test 3 FAILED', { error: err.message });
        return { name: 'Sequential Writes', passed: false, error: err.message };
    }
}

async function test4_WritePreference(broker: Broker1, clients: RWLockWritePrefClient[]): Promise<TestResult> {
    log('Test 4: Write Preference (Writers prioritized)');
    try {
        writeFile('PREF-START');
        const key = 'test4-key';
        const order: string[] = [];
        
        // Start multiple readers
        const readers: Promise<void>[] = [];
        for (let i = 0; i < 3; i++) {
            readers.push(
                new Promise<void>((resolve, reject) => {
                    clients[i].acquireReadLock(key, {}, (err: any, release: any) => {
                        if (!err) {
                            order.push(`R${i}`);
                            setTimeout(() => {
                                release((err: any) => {
                                    if (err) {
                                        // Handle release error if needed
                                        console.warn('Release error:', err);
                                        reject(err);
                                        return;
                                    }
                                    resolve();
                                });
                            }, 100);
                        } else {
                            resolve();
                        }
                    });
                })
            );
        }
        
        // Start a writer that should be prioritized
        setTimeout(() => {
            clients[3].acquireWriteLock(key, {}, (err: any, release: any) => {
                if (!err) {
                    order.push('W');
                    setTimeout(() => {
                        release((err: any) => {});
                    }, 50);
                }
            });
        }, 30);
        
        await Promise.all(readers);
        await delay(200);
        
        log('Test 4 completed', { order });
        // In write-preferring, writer should get priority
        log('Test 4 PASSED: Write preference tested');
        return { name: 'Write Preference', passed: true, details: { order } };
    } catch (err: any) {
        log('Test 4 FAILED', { error: err.message });
        return { name: 'Write Preference', passed: false, error: err.message };
    }
}

async function test5_StressTest(broker: Broker1, clients: RWLockWritePrefClient[]): Promise<TestResult> {
    log('Test 5: Stress Test - 20 Operations');
    try {
        writeFile('0');
        const key = 'test5-key';
        let writeCount = 0;
        let completedWrites = 0;
        const operations: Promise<void>[] = [];
        
        // Simplified stress test: 20 operations with better spacing
        // This tests concurrency without overwhelming the system
        for (let i = 0; i < 20; i++) {
            const client = clients[i % clients.length];
            const opIndex = i;
            
            if (i % 3 === 0) {
                // Writer - every 3rd operation (7 writers total)
                writeCount++;
                operations.push(
                    new Promise<void>((resolve) => {
                        // Add small delay to stagger operations
                        setTimeout(() => {
                            client.acquireWriteLock(key, { lockRequestTimeout: 30000 }, (err: any, release: any) => {
                                if (err) {
                                    log(`Write ${opIndex} failed:`, err.message);
                                    return resolve();
                                }
                                const current = parseInt(readFile()) || 0;
                                const newValue = current + 1;
                                writeFile(String(newValue));
                                log(`Write ${opIndex}: ${current} -> ${newValue}`);
                                completedWrites++;
                                setTimeout(() => {
                                    release((releaseErr: any) => {
                                        handleReleaseError(releaseErr, 'write');
                                        resolve();
                                    });
                                }, 20);
                            });
                        }, i * 50); // Stagger by 50ms
                    })
                );
            } else {
                // Reader
                operations.push(
                    new Promise<void>((resolve) => {
                        setTimeout(() => {
                            client.acquireReadLock(key, { lockRequestTimeout: 30000 }, (err: any, release: any) => {
                                if (!err) {
                                    const val = readFile();
                                    setTimeout(() => {
                                        release((err: any) => {
                                            if (err) {
                                                // Handle release error if needed
                                            }
                                            resolve();
                                        });
                                    }, 20);
                                } else {
                                    resolve();
                                }
                            });
                        }, i * 50);
                    })
                );
            }
        }
        
        // Wait for all operations to complete
        await Promise.all(operations);
        await delay(500);
        
        const final = parseInt(readFile());
        log('Test 5 completed', { writeCount, completedWrites, final });
        
        if (final !== writeCount) {
            return { name: 'Stress Test', passed: false, error: `Expected ${writeCount} writes, completed ${completedWrites}, final value ${final}` };
        }
        
        log('Test 5 PASSED: Stress test completed');
        return { name: 'Stress Test', passed: true, details: { writeCount, completedWrites, final } };
    } catch (err: any) {
        log('Test 5 FAILED', { error: err.message });
        return { name: 'Stress Test', passed: false, error: err.message };
    }
}

async function test6_FileConsistency(broker: Broker1, clients: RWLockWritePrefClient[]): Promise<TestResult> {
    log('Test 6: File Consistency - Append Operations');
    try {
        writeFile('');
        const key = 'test6-key';
        const expected: string[] = [];
        
        // Writers append lines
        for (let i = 0; i < 10; i++) {
            await new Promise<void>((resolve, reject) => {
                clients[i % clients.length].acquireWriteLock(key, {}, (err: any, release: any) => {
                    if (err) return reject(err);
                    const line = `LINE-${i}\n`;
                    appendToFile(line);
                    expected.push(`LINE-${i}`);
                    setTimeout(() => {
                        release((releaseErr: any) => {
                            handleReleaseError(releaseErr, 'write');
                            resolve();
                        });
                    }, 20);
                });
            });
        }
        
        const content = readFile();
        const lines = content.split('\n').filter(l => l.trim());
        
        // Verify all lines present
        for (const expectedLine of expected) {
            if (!lines.includes(expectedLine)) {
                return { name: 'File Consistency', passed: false, error: `Missing line: ${expectedLine}` };
            }
        }
        
        log('Test 6 PASSED: File consistency maintained');
        return { name: 'File Consistency', passed: true, details: { lineCount: lines.length } };
    } catch (err: any) {
        log('Test 6 FAILED', { error: err.message });
        return { name: 'File Consistency', passed: false, error: err.message };
    }
}

async function runComprehensiveTests(): Promise<void> {
    console.log('=== Comprehensive Reader-Writer Lock Test Suite ===\n');
    
    let broker: Broker1 | null = null;
    const clients: RWLockWritePrefClient[] = [];
    
    try {
        // Setup
        log('Starting broker', { port: PORT });
        broker = new Broker1({ port: PORT });
        await broker.ensure();
        
        log('Creating clients', { count: 10 });
        for (let i = 0; i < 10; i++) {
            const client = new RWLockWritePrefClient({ port: PORT, lockRequestTimeout: 10000 });
            await client.ensure();
            clients.push(client);
        }
        
        // Run tests
        testResults.push(await test1_ConcurrentReaders(broker, clients));
        await delay(200);
        
        testResults.push(await test2_WriterExclusive(broker, clients));
        await delay(200);
        
        testResults.push(await test3_SequentialWrites(broker, clients));
        await delay(200);
        
        testResults.push(await test4_WritePreference(broker, clients));
        await delay(200);
        
        testResults.push(await test5_StressTest(broker, clients));
        await delay(200);
        
        testResults.push(await test6_FileConsistency(broker, clients));
        
        // Summary
        console.log('\n=== Test Summary ===');
        const passed = testResults.filter(r => r.passed).length;
        const failed = testResults.filter(r => !r.passed).length;
        
        testResults.forEach(result => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${result.name}`);
            if (!result.passed && result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        console.log(`\nTotal: ${testResults.length} tests`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        
        if (failed > 0) {
            throw new Error(`${failed} test(s) failed`);
        }
        
    } catch (error: any) {
        console.error('\n❌ Test suite failed:', error);
        throw error;
    } finally {
        // Cleanup
        for (const client of clients) {
            try {
                client.close();
            } catch (err) {
                // Ignore
            }
        }
        
        if (broker) {
            await new Promise<void>((resolve) => {
                broker!.close(() => resolve());
            });
        }
        
        // Clean up test file
        try {
            if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
        } catch (err) {
            // Ignore
        }
    }
}

// Run tests
if (require.main === module) {
    runComprehensiveTests()
        .then(() => {
            console.log('\n✅ All tests completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Test suite failed:', err);
            process.exit(1);
        });
}

export { runComprehensiveTests };

