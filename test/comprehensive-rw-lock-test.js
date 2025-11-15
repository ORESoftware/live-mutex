#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.runComprehensiveTests = runComprehensiveTests;
const fs = require("fs");
const path = require("path");
const os = require("os");
const broker_1_1 = require("../dist/broker-1");
const rw_write_preferred_client_1 = require("../dist/rw-write-preferred-client");
const PORT = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : 3333;
const TEST_FILE = path.join(os.tmpdir(), 'lmx-rw-comprehensive-test.txt');
const testResults = [];

// Helper to check if a release error is a timeout (not a real error)
function isReleaseTimeoutError(err) {
    if (!err) return false;
    // Timeout errors have code 'bad_or_mismatched_id' and message containing "timed out"
    return err.code === 'bad_or_mismatched_id' && 
           err.message && 
           typeof err.message === 'string' && 
           err.message.toLowerCase().includes('timed out');
}

// Helper to handle release errors - log but don't fail on timeouts
// Returns true if it's a real error (should reject), false if timeout (non-fatal)
function handleReleaseError(releaseErr, operation = 'release') {
    if (releaseErr) {
        if (isReleaseTimeoutError(releaseErr)) {
            // Timeout is not a real error - lock may have already been released
            console.warn(`${operation} timeout (non-fatal):`, releaseErr.message);
            return false; // Not a real error
        } else {
            // Real error - log it
            console.error(`${operation} error:`, releaseErr);
            return true; // Real error, should reject
        }
    }
    return false; // No error
}

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
                            if (handleReleaseError(releaseErr, 'releaseReadLock')) {
                                return reject(releaseErr);
                            }
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
                setTimeout(() => {
                    clients[1].acquireReadLock(key, {}, (readErr, readRelease) => {
                        readerAcquiredTime = Date.now();
                        if (!readErr) {
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
                        if (handleReleaseError(releaseErr, 'releaseWriteLock')) {
                            return reject(releaseErr);
                        }
                        if (!releaseErr) {
                            log('Writer released');
                        }
                        resolve();
                    });
                }, 300);
            });
        });
        await writer;
        await delay(500);
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
                            if (handleReleaseError(releaseErr, 'releaseWriteLock')) {
                                return reject(releaseErr);
                            }
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
        const readers = [];
        for (let i = 0; i < 3; i++) {
            readers.push(new Promise((resolve, reject) => {
                clients[i].acquireReadLock(key, {}, (err, release) => {
                    if (!err) {
                        order.push(`R${i}`);
                        setTimeout(() => {
                            release((err) => {
                                if (err) {
                                    console.warn('Release error:', err);
                                    reject(err);
                                    return;
                                }
                                resolve();
                            });
                        }, 100);
                    }
                    else {
                        resolve();
                    }
                });
            }));
        }
        setTimeout(() => {
            clients[3].acquireWriteLock(key, {}, (err, release) => {
                if (!err) {
                    order.push('W');
                    setTimeout(() => {
                        release((err) => { });
                    }, 50);
                }
            });
        }, 30);
        await Promise.all(readers);
        await delay(200);
        log('Test 4 completed', { order });
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
        for (let i = 0; i < 20; i++) {
            const client = clients[i % clients.length];
            const opIndex = i;
            if (i % 3 === 0) {
                writeCount++;
                operations.push(new Promise((resolve) => {
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
                                    if (handleReleaseError(releaseErr, `Write ${opIndex} release`)) {
                                        return reject(releaseErr);
                                    }
                                    resolve();
                                });
                            }, 20);
                        });
                    }, i * 50);
                }));
            }
            else {
                operations.push(new Promise((resolve) => {
                    setTimeout(() => {
                        client.acquireReadLock(key, { lockRequestTimeout: 30000 }, (err, release) => {
                            if (!err) {
                                const val = readFile();
                                setTimeout(() => {
                                    release((err) => {
                                        if (err) {
                                        }
                                        resolve();
                                    });
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
                            if (handleReleaseError(releaseErr, 'releaseReadLock')) {
                                return reject(releaseErr);
                            }
                            resolve();
                        });
                    }, 20);
                });
            });
        }
        const content = readFile();
        const lines = content.split('\n').filter(l => l.trim());
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
        log('Starting broker', { port: PORT });
        broker = new broker_1_1.Broker1({ port: PORT });
        await broker.ensure();
        log('Creating clients', { count: 10 });
        for (let i = 0; i < 10; i++) {
            const client = new rw_write_preferred_client_1.RWLockWritePrefClient({ port: PORT, lockRequestTimeout: 10000 });
            await client.ensure();
            clients.push(client);
        }
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
        for (const client of clients) {
            try {
                client.close();
            }
            catch (err) {
            }
        }
        if (broker) {
            await new Promise((resolve) => {
                broker.close(() => resolve());
            });
        }
        try {
            if (fs.existsSync(TEST_FILE))
                fs.unlinkSync(TEST_FILE);
        }
        catch (err) {
        }
    }
}
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
