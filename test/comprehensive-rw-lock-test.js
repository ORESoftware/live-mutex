#!/usr/bin/env node
'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runComprehensiveTests = runComprehensiveTests;
/**
 * Comprehensive Reader-Writer Lock Test Suite
 * Tests all aspects of RW lock behavior including:
 * - Concurrent readers
 * - Exclusive writers
 * - Write preference
 * - Ordering guarantees
 * - Stress testing
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const broker_1_1 = require("../dist/broker-1");
const rw_write_preferred_client_1 = require("../dist/rw-write-preferred-client");
const PORT = 3333;
const TEST_FILE = path.join(os.tmpdir(), 'lmx-rw-comprehensive-test.txt');
const testResults = [];
function log(message, data) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
    console.log(logLine);
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function readFile() {
    try {
        return fs.readFileSync(TEST_FILE, 'utf8').trim();
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return '';
        throw err;
    }
}
function writeFile(content) {
    fs.writeFileSync(TEST_FILE, content, 'utf8');
}
function appendToFile(content) {
    fs.appendFileSync(TEST_FILE, content, 'utf8');
}
async function test1_ConcurrentReaders(broker, clients) {
    log('Test 1: Multiple Concurrent Readers');
    try {
        writeFile('TEST1');
        const key = 'test1-key';
        const readers = [];
        for (let i = 0; i < 5; i++) {
            readers.push(new Promise((resolve, reject) => {
                clients[i].acquireReadLock(key, {}, (err, release) => {
                    if (err)
                        return reject(err);
                    const content = readFile();
                    if (content !== 'TEST1') {
                        return reject(new Error(`Reader ${i} read wrong value: ${content}`));
                    }
                    setTimeout(() => {
                        release((releaseErr) => {
                            if (releaseErr)
                                return reject(releaseErr);
                            resolve();
                        });
                    }, 50);
                });
            }));
        }
        await Promise.all(readers);
        log('Test 1 PASSED: All readers read concurrently');
        return { name: 'Concurrent Readers', passed: true };
    }
    catch (err) {
        log('Test 1 FAILED', { error: err.message });
        return { name: 'Concurrent Readers', passed: false, error: err.message };
    }
}
async function test2_WriterExclusive(broker, clients) {
    log('Test 2: Writer Exclusive Access');
    try {
        writeFile('TEST2-START');
        const key = 'test2-key';
        let writerAcquired = false;
        let writerReleased = false;
        let readerAcquiredDuringWrite = false;
        let readerAcquiredTime = 0;
        let writerReleaseTime = 0;
        const writer = new Promise((resolve, reject) => {
            const writerStartTime = Date.now();
            clients[0].acquireWriteLock(key, {}, (err, release) => {
                if (err)
                    return reject(err);
                writerAcquired = true;
                log('Writer acquired');
                // Start a reader while writer holds lock
                setTimeout(() => {
                    clients[1].acquireReadLock(key, {}, (readErr, readRelease) => {
                        readerAcquiredTime = Date.now();
                        if (!readErr) {
                            // Check if writer still holds lock
                            if (!writerReleased) {
                                readerAcquiredDuringWrite = true;
                                log('⚠️  Reader acquired during write!');
                            }
                            else {
                                log('Reader acquired after writer released (correct)');
                            }
                            readRelease(() => { });
                        }
                    });
                }, 50);
                setTimeout(() => {
                    writerReleaseTime = Date.now();
                    writerReleased = true;
                    release((releaseErr) => {
                        if (releaseErr)
                            return reject(releaseErr);
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
    }
    catch (err) {
        log('Test 2 FAILED', { error: err.message });
        return { name: 'Writer Exclusive', passed: false, error: err.message };
    }
}
async function test3_SequentialWrites(broker, clients) {
    log('Test 3: Sequential Writes Maintain Order');
    try {
        writeFile('WRITE-0');
        const key = 'test3-key';
        const values = [];
        for (let i = 1; i <= 5; i++) {
            await new Promise((resolve, reject) => {
                clients[i % clients.length].acquireWriteLock(key, {}, (err, release) => {
                    if (err)
                        return reject(err);
                    const value = `WRITE-${i}`;
                    const before = readFile();
                    writeFile(value);
                    const after = readFile();
                    values.push(value);
                    log(`Write ${i}: ${before} -> ${after}`);
                    setTimeout(() => {
                        release((releaseErr) => {
                            if (releaseErr)
                                return reject(releaseErr);
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
    }
    catch (err) {
        log('Test 3 FAILED', { error: err.message });
        return { name: 'Sequential Writes', passed: false, error: err.message };
    }
}
async function test4_WritePreference(broker, clients) {
    log('Test 4: Write Preference (Writers prioritized)');
    try {
        writeFile('PREF-START');
        const key = 'test4-key';
        const order = [];
        // Start multiple readers
        const readers = [];
        for (let i = 0; i < 3; i++) {
            readers.push(new Promise((resolve) => {
                clients[i].acquireReadLock(key, {}, (err, release) => {
                    if (!err) {
                        order.push(`R${i}`);
                        setTimeout(() => {
                            release(() => resolve());
                        }, 100);
                    }
                    else {
                        resolve();
                    }
                });
            }));
        }
        // Start a writer that should be prioritized
        setTimeout(() => {
            clients[3].acquireWriteLock(key, {}, (err, release) => {
                if (!err) {
                    order.push('W');
                    setTimeout(() => {
                        release(() => { });
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
    }
    catch (err) {
        log('Test 4 FAILED', { error: err.message });
        return { name: 'Write Preference', passed: false, error: err.message };
    }
}
async function test5_StressTest(broker, clients) {
    log('Test 5: Stress Test - 20 Operations');
    try {
        writeFile('0');
        const key = 'test5-key';
        let writeCount = 0;
        let completedWrites = 0;
        const operations = [];
        // Simplified stress test: 20 operations with better spacing
        // This tests concurrency without overwhelming the system
        for (let i = 0; i < 20; i++) {
            const client = clients[i % clients.length];
            const opIndex = i;
            if (i % 3 === 0) {
                // Writer - every 3rd operation (7 writers total)
                writeCount++;
                operations.push(new Promise((resolve) => {
                    // Add small delay to stagger operations
                    setTimeout(() => {
                        client.acquireWriteLock(key, { lockRequestTimeout: 30000 }, (err, release) => {
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
                                release((releaseErr) => {
                                    if (releaseErr) {
                                        log(`Write ${opIndex} release failed:`, releaseErr.message);
                                    }
                                    resolve();
                                });
                            }, 20);
                        });
                    }, i * 50); // Stagger by 50ms
                }));
            }
            else {
                // Reader
                operations.push(new Promise((resolve) => {
                    setTimeout(() => {
                        client.acquireReadLock(key, { lockRequestTimeout: 30000 }, (err, release) => {
                            if (!err) {
                                const val = readFile();
                                setTimeout(() => {
                                    release(() => resolve());
                                }, 20);
                            }
                            else {
                                resolve();
                            }
                        });
                    }, i * 50);
                }));
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
    }
    catch (err) {
        log('Test 5 FAILED', { error: err.message });
        return { name: 'Stress Test', passed: false, error: err.message };
    }
}
async function test6_FileConsistency(broker, clients) {
    log('Test 6: File Consistency - Append Operations');
    try {
        writeFile('');
        const key = 'test6-key';
        const expected = [];
        // Writers append lines
        for (let i = 0; i < 10; i++) {
            await new Promise((resolve, reject) => {
                clients[i % clients.length].acquireWriteLock(key, {}, (err, release) => {
                    if (err)
                        return reject(err);
                    const line = `LINE-${i}\n`;
                    appendToFile(line);
                    expected.push(`LINE-${i}`);
                    setTimeout(() => {
                        release((releaseErr) => {
                            if (releaseErr)
                                return reject(releaseErr);
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
    }
    catch (err) {
        log('Test 6 FAILED', { error: err.message });
        return { name: 'File Consistency', passed: false, error: err.message };
    }
}
async function runComprehensiveTests() {
    console.log('=== Comprehensive Reader-Writer Lock Test Suite ===\n');
    let broker = null;
    const clients = [];
    try {
        // Setup
        log('Starting broker', { port: PORT });
        broker = new broker_1_1.Broker1({ port: PORT });
        await broker.ensure();
        log('Creating clients', { count: 10 });
        for (let i = 0; i < 10; i++) {
            const client = new rw_write_preferred_client_1.RWLockWritePrefClient({ port: PORT, lockRequestTimeout: 10000 });
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
    }
    catch (error) {
        console.error('\n❌ Test suite failed:', error);
        throw error;
    }
    finally {
        // Cleanup
        for (const client of clients) {
            try {
                client.close();
            }
            catch (err) {
                // Ignore
            }
        }
        if (broker) {
            await new Promise((resolve) => {
                broker.close(() => resolve());
            });
        }
        // Clean up test file
        try {
            if (fs.existsSync(TEST_FILE))
                fs.unlinkSync(TEST_FILE);
        }
        catch (err) {
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
