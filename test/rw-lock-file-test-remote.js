"use strict";
/**
 * Reader-Writer Lock File Test (Remote Version)
 * Tests RW locks by reading/writing to a file to verify correct ordering
 * Uses extensive debug logging to track operation order
 */
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const broker_1 = require("../dist/broker");
const rw_write_preferred_client_1 = require("../dist/rw-write-preferred-client");
const PORT = 4444;
const TEST_FILE = path.join(os.tmpdir(), 'lmx-rw-test.txt');
const LOG_FILE = path.join(os.tmpdir(), 'lmx-rw-test.log');
const debugLog = [];
let logCounter = 0;
function debug(message, data = {}) {
    const timestamp = Date.now();
    const entry = Object.assign({ id: ++logCounter, timestamp, time: new Date().toISOString(), message }, data);
    debugLog.push(entry);
    const logLine = `[${entry.time}] [${entry.id}] ${message}${Object.keys(data).length > 0 ? ' ' + JSON.stringify(data) : ''}`;
    console.log(logLine);
    // Also write to log file
    try {
        fs.appendFileSync(LOG_FILE, logLine + '\n');
    }
    catch (err) {
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
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            return '';
        }
        throw err;
    }
}
function writeFile(content) {
    fs.writeFileSync(TEST_FILE, content, 'utf8');
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
        if (fs.existsSync(TEST_FILE))
            fs.unlinkSync(TEST_FILE);
        if (fs.existsSync(LOG_FILE))
            fs.unlinkSync(LOG_FILE);
    }
    catch (err) {
        // Ignore
    }
    let broker = null;
    const clients = [];
    try {
        debug('Starting broker', { port: PORT });
        broker = new broker_1.Broker({ port: PORT });
        await broker.ensure();
        debug('Broker started');
        // Create clients
        debug('Creating RW lock clients', { count: 5 });
        for (let i = 0; i < 5; i++) {
            const client = new rw_write_preferred_client_1.RWLockWritePrefClient({ port: PORT });
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
                }
                else {
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
        const operations = debugLog.filter(e => e.message.includes('acquired') ||
            e.message.includes('released') ||
            e.message.includes('wrote') ||
            e.message.includes('read file'));
        debug('Operation timeline', {
            totalOperations: operations.length,
            sample: operations.slice(0, 10).map(e => ({
                time: e.time,
                message: e.message
            }))
        });
        // Check for violations
        const violations = [];
        let currentWriter = null;
        const activeReaders = new Set();
        for (const op of operations) {
            if (op.message.includes('acquired write lock')) {
                if (activeReaders.size > 0) {
                    violations.push(`Writer ${op.writerId} acquired while ${activeReaders.size} readers active`);
                }
                if (currentWriter) {
                    violations.push(`Writer ${op.writerId} acquired while writer ${currentWriter} active`);
                }
                currentWriter = op.writerId;
            }
            else if (op.message.includes('acquired read lock')) {
                if (currentWriter) {
                    violations.push(`Reader ${op.readerId} acquired while writer ${currentWriter} active`);
                }
                activeReaders.add(op.readerId);
            }
            else if (op.message.includes('released write lock')) {
                currentWriter = null;
            }
            else if (op.message.includes('released read lock')) {
                activeReaders.delete(op.readerId);
            }
        }
        if (violations.length > 0) {
            debug('⚠️  VIOLATIONS DETECTED', { violations });
            console.log('\n❌ Test FAILED: Lock violations detected!');
            violations.forEach(v => console.log(`  - ${v}`));
        }
        else {
            debug('✓ No violations detected', {});
            console.log('\n✅ Test PASSED: All operations followed correct ordering!');
        }
        // Final file state
        const finalContent = readFile();
        debug('Final file state', { content: finalContent });
        console.log(`\n=== Test Complete ===`);
        console.log(`Log file: ${LOG_FILE}`);
        console.log(`Total log entries: ${debugLog.length}`);
    }
    catch (error) {
        debug('Test failed with error', { error: error.message, stack: error.stack });
        console.error('\n❌ Test failed:', error);
        throw error;
    }
    finally {
        // Cleanup
        debug('Cleaning up', {});
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
