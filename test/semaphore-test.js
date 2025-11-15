"use strict";
/**
 * Semaphore Test Suite
 * Tests the primary Client class semaphore functionality
 * - Default max=1 (exclusive lock)
 * - Custom max values (3, 10, etc.)
 * - Concurrent lockholders verification
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
const main_1 = require("../dist/main");
// Create a temporary file for testing
function createTempFile() {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `lmx-semaphore-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`);
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
async function testDefaultMaxOne() {
    console.log('\n=== Test 1: Default max=1 (Exclusive Lock) ===');
    const port = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : (8000 + Math.floor(Math.random() * 1000));
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    const clients = [];
    for (let i = 0; i < 5; i++) {
        const client = new main_1.Client({ port });
        await client.ensure();
        clients.push(client);
    }
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    console.log('Testing default behavior (no max specified) - should allow only 1 concurrent holder');
    try {
        let concurrentCount = 0;
        let maxConcurrent = 0;
        let violations = 0;
        const promises = clients.map((client, index) => {
            return new Promise((resolve, reject) => {
                // Don't specify max - should default to 1
                client.lock('default-key', {}, (err, unlock) => {
                    if (err)
                        return reject(err);
                    concurrentCount++;
                    maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                    // With default max=1, we should never have more than 1 concurrent holder
                    if (concurrentCount > 1) {
                        violations++;
                        console.error(`  ⚠️  VIOLATION: ${concurrentCount} concurrent holders (expected max 1)`);
                    }
                    console.log(`  Client ${index} acquired lock (concurrent: ${concurrentCount})`);
                    // Increment file value
                    const currentValue = readFile(tmpFile);
                    writeFile(tmpFile, currentValue + 1);
                    // Hold lock for a bit
                    setTimeout(() => {
                        concurrentCount--;
                        unlock((unlockErr) => {
                            if (unlockErr)
                                return reject(unlockErr);
                            console.log(`  Client ${index} released lock (concurrent: ${concurrentCount})`);
                            resolve();
                        });
                    }, 50 + Math.random() * 50);
                });
            });
        });
        await Promise.all(promises);
        const finalValue = readFile(tmpFile);
        if (finalValue !== 5) {
            throw new Error(`Expected final value 5, got ${finalValue}`);
        }
        if (maxConcurrent > 1) {
            throw new Error(`Default max=1 violated! Max concurrent: ${maxConcurrent}, expected: 1`);
        }
        if (violations > 0) {
            throw new Error(`Found ${violations} violations of max=1 constraint`);
        }
        console.log(`✅ Default max=1 test passed`);
        console.log(`   Max concurrent: ${maxConcurrent} (expected: 1)`);
        console.log(`   Final file value: ${finalValue} (expected: 5)`);
    }
    catch (err) {
        console.error('❌ Default max=1 test failed:', err.message);
        throw err;
    }
    finally {
        await new Promise(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try {
            fs.unlinkSync(tmpFile);
        }
        catch (e) { }
    }
}
async function testSemaphoreMaxThree() {
    console.log('\n=== Test 2: Semaphore max=3 (3 Concurrent Holders) ===');
    const port = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : (8000 + Math.floor(Math.random() * 1000));
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    const clients = [];
    for (let i = 0; i < 10; i++) {
        const client = new main_1.Client({ port });
        await client.ensure();
        clients.push(client);
    }
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    console.log('Testing semaphore with max=3 - should allow up to 3 concurrent holders');
    try {
        let concurrentCount = 0;
        let maxConcurrent = 0;
        const maxHolders = 3;
        let violations = 0;
        const promises = clients.map((client, index) => {
            return new Promise((resolve, reject) => {
                client.lock('semaphore-key', { max: maxHolders }, (err, unlock) => {
                    if (err)
                        return reject(err);
                    concurrentCount++;
                    maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                    // Should never exceed maxHolders
                    if (concurrentCount > maxHolders) {
                        violations++;
                        console.error(`  ⚠️  VIOLATION: ${concurrentCount} concurrent holders (max: ${maxHolders})`);
                    }
                    console.log(`  Client ${index} acquired semaphore (concurrent: ${concurrentCount}/${maxHolders})`);
                    // Increment file value
                    const currentValue = readFile(tmpFile);
                    writeFile(tmpFile, currentValue + 1);
                    // Hold lock for a bit
                    setTimeout(() => {
                        concurrentCount--;
                        unlock((unlockErr) => {
                            if (unlockErr)
                                return reject(unlockErr);
                            console.log(`  Client ${index} released semaphore (concurrent: ${concurrentCount})`);
                            resolve();
                        });
                    }, 50 + Math.random() * 100);
                });
            });
        });
        await Promise.all(promises);
        const finalValue = readFile(tmpFile);
        if (finalValue !== 10) {
            throw new Error(`Expected final value 10, got ${finalValue}`);
        }
        if (maxConcurrent > maxHolders) {
            throw new Error(`Semaphore limit exceeded! Max concurrent: ${maxConcurrent}, Limit: ${maxHolders}`);
        }
        if (maxConcurrent < 1) {
            throw new Error(`No concurrent access detected! Max concurrent: ${maxConcurrent}`);
        }
        if (violations > 0) {
            throw new Error(`Found ${violations} violations of max=${maxHolders} constraint`);
        }
        console.log(`✅ Semaphore max=3 test passed`);
        console.log(`   Max concurrent: ${maxConcurrent} (limit: ${maxHolders})`);
        console.log(`   Final file value: ${finalValue} (expected: 10)`);
    }
    catch (err) {
        console.error('❌ Semaphore max=3 test failed:', err.message);
        throw err;
    }
    finally {
        await new Promise(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try {
            fs.unlinkSync(tmpFile);
        }
        catch (e) { }
    }
}
async function testSemaphoreMaxTen() {
    console.log('\n=== Test 3: Semaphore max=10 (10 Concurrent Holders) ===');
    const port = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : (8000 + Math.floor(Math.random() * 1000));
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    const clients = [];
    for (let i = 0; i < 20; i++) {
        const client = new main_1.Client({ port });
        await client.ensure();
        clients.push(client);
    }
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    console.log('Testing semaphore with max=10 - should allow up to 10 concurrent holders');
    try {
        let concurrentCount = 0;
        let maxConcurrent = 0;
        const maxHolders = 10;
        let violations = 0;
        const promises = clients.map((client, index) => {
            return new Promise((resolve, reject) => {
                client.lock('semaphore-key-10', { max: maxHolders }, (err, unlock) => {
                    if (err)
                        return reject(err);
                    concurrentCount++;
                    maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                    // Should never exceed maxHolders
                    if (concurrentCount > maxHolders) {
                        violations++;
                        console.error(`  ⚠️  VIOLATION: ${concurrentCount} concurrent holders (max: ${maxHolders})`);
                    }
                    if (index < 5 || index % 5 === 0) {
                        console.log(`  Client ${index} acquired semaphore (concurrent: ${concurrentCount}/${maxHolders})`);
                    }
                    // Increment file value
                    const currentValue = readFile(tmpFile);
                    writeFile(tmpFile, currentValue + 1);
                    // Hold lock for a bit
                    setTimeout(() => {
                        concurrentCount--;
                        unlock((unlockErr) => {
                            if (unlockErr)
                                return reject(unlockErr);
                            if (index < 5 || index % 5 === 0) {
                                console.log(`  Client ${index} released semaphore (concurrent: ${concurrentCount})`);
                            }
                            resolve();
                        });
                    }, 30 + Math.random() * 70);
                });
            });
        });
        await Promise.all(promises);
        const finalValue = readFile(tmpFile);
        if (finalValue !== 20) {
            throw new Error(`Expected final value 20, got ${finalValue}`);
        }
        if (maxConcurrent > maxHolders) {
            throw new Error(`Semaphore limit exceeded! Max concurrent: ${maxConcurrent}, Limit: ${maxHolders}`);
        }
        if (maxConcurrent < 1) {
            throw new Error(`No concurrent access detected! Max concurrent: ${maxConcurrent}`);
        }
        if (violations > 0) {
            throw new Error(`Found ${violations} violations of max=${maxHolders} constraint`);
        }
        console.log(`✅ Semaphore max=10 test passed`);
        console.log(`   Max concurrent: ${maxConcurrent} (limit: ${maxHolders})`);
        console.log(`   Final file value: ${finalValue} (expected: 20)`);
    }
    catch (err) {
        console.error('❌ Semaphore max=10 test failed:', err.message);
        throw err;
    }
    finally {
        await new Promise(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try {
            fs.unlinkSync(tmpFile);
        }
        catch (e) { }
    }
}
async function testSemaphoreStress() {
    console.log('\n=== Test 4: Semaphore Stress Test (max=5, 50 clients, 10 ops each) ===');
    const port = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : (8000 + Math.floor(Math.random() * 1000));
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    const clients = [];
    for (let i = 0; i < 50; i++) {
        const client = new main_1.Client({ port });
        await client.ensure();
        clients.push(client);
    }
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    console.log('Stress testing: 50 clients, 10 operations each, max=5 concurrent');
    try {
        const maxHolders = 5;
        let concurrentCount = 0;
        let maxConcurrent = 0;
        let totalOperations = 0;
        let violations = 0;
        const operationsPerClient = 10;
        const allPromises = [];
        for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
            const client = clients[clientIndex];
            for (let op = 0; op < operationsPerClient; op++) {
                allPromises.push(new Promise((resolve, reject) => {
                    client.lock('stress-semaphore', { max: maxHolders }, (err, unlock) => {
                        if (err)
                            return reject(err);
                        concurrentCount++;
                        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                        totalOperations++;
                        // Should never exceed maxHolders
                        if (concurrentCount > maxHolders) {
                            violations++;
                            if (violations <= 5) { // Only log first few violations
                                console.error(`  ⚠️  VIOLATION #${violations}: ${concurrentCount} concurrent holders (max: ${maxHolders})`);
                            }
                        }
                        // Increment file value
                        const currentValue = readFile(tmpFile);
                        writeFile(tmpFile, currentValue + 1);
                        // Simulate work
                        setTimeout(() => {
                            concurrentCount--;
                            unlock((unlockErr) => {
                                if (unlockErr)
                                    return reject(unlockErr);
                                resolve();
                            });
                        }, Math.random() * 20);
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
            throw new Error(`Semaphore limit exceeded! Max concurrent: ${maxConcurrent}, Limit: ${maxHolders}`);
        }
        if (violations > 0) {
            throw new Error(`Found ${violations} violations of max=${maxHolders} constraint`);
        }
        console.log(`✅ Semaphore stress test passed`);
        console.log(`   Total operations: ${totalOperations}`);
        console.log(`   Max concurrent: ${maxConcurrent} (limit: ${maxHolders})`);
        console.log(`   Final file value: ${finalValue} (expected: ${expectedValue})`);
    }
    catch (err) {
        console.error('❌ Semaphore stress test failed:', err.message);
        throw err;
    }
    finally {
        await new Promise(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try {
            fs.unlinkSync(tmpFile);
        }
        catch (e) { }
    }
}
async function testMixedMaxValues() {
    console.log('\n=== Test 5: Mixed Max Values (Different keys with different max) ===');
    const port = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : (8000 + Math.floor(Math.random() * 1000));
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    const clients = [];
    for (let i = 0; i < 15; i++) {
        const client = new main_1.Client({ port });
        await client.ensure();
        clients.push(client);
    }
    const tmpFile1 = createTempFile();
    const tmpFile2 = createTempFile();
    const tmpFile3 = createTempFile();
    writeFile(tmpFile1, 0);
    writeFile(tmpFile2, 0);
    writeFile(tmpFile3, 0);
    console.log('Testing different keys with different max values simultaneously');
    console.log('  key1: max=1 (default), key2: max=3, key3: max=5');
    try {
        let concurrent1 = 0, maxConcurrent1 = 0;
        let concurrent2 = 0, maxConcurrent2 = 0;
        let concurrent3 = 0, maxConcurrent3 = 0;
        const promises = [];
        // Key 1: default max=1
        for (let i = 0; i < 5; i++) {
            promises.push(new Promise((resolve, reject) => {
                clients[i].lock('key1', {}, (err, unlock) => {
                    if (err)
                        return reject(err);
                    concurrent1++;
                    maxConcurrent1 = Math.max(maxConcurrent1, concurrent1);
                    const val = readFile(tmpFile1);
                    writeFile(tmpFile1, val + 1);
                    setTimeout(() => {
                        concurrent1--;
                        unlock((unlockErr) => {
                            if (unlockErr)
                                return reject(unlockErr);
                            resolve();
                        });
                    }, 50);
                });
            }));
        }
        // Key 2: max=3
        for (let i = 5; i < 10; i++) {
            promises.push(new Promise((resolve, reject) => {
                clients[i].lock('key2', { max: 3 }, (err, unlock) => {
                    if (err)
                        return reject(err);
                    concurrent2++;
                    maxConcurrent2 = Math.max(maxConcurrent2, concurrent2);
                    const val = readFile(tmpFile2);
                    writeFile(tmpFile2, val + 1);
                    setTimeout(() => {
                        concurrent2--;
                        unlock((unlockErr) => {
                            if (unlockErr)
                                return reject(unlockErr);
                            resolve();
                        });
                    }, 50);
                });
            }));
        }
        // Key 3: max=5
        for (let i = 10; i < 15; i++) {
            promises.push(new Promise((resolve, reject) => {
                clients[i].lock('key3', { max: 5 }, (err, unlock) => {
                    if (err)
                        return reject(err);
                    concurrent3++;
                    maxConcurrent3 = Math.max(maxConcurrent3, concurrent3);
                    const val = readFile(tmpFile3);
                    writeFile(tmpFile3, val + 1);
                    setTimeout(() => {
                        concurrent3--;
                        unlock((unlockErr) => {
                            if (unlockErr)
                                return reject(unlockErr);
                            resolve();
                        });
                    }, 50);
                });
            }));
        }
        await Promise.all(promises);
        const val1 = readFile(tmpFile1);
        const val2 = readFile(tmpFile2);
        const val3 = readFile(tmpFile3);
        if (maxConcurrent1 > 1) {
            throw new Error(`Key1 (default) exceeded max=1: ${maxConcurrent1}`);
        }
        if (maxConcurrent2 > 3) {
            throw new Error(`Key2 (max=3) exceeded limit: ${maxConcurrent2}`);
        }
        if (maxConcurrent3 > 5) {
            throw new Error(`Key3 (max=5) exceeded limit: ${maxConcurrent3}`);
        }
        console.log(`✅ Mixed max values test passed`);
        console.log(`   Key1 (default): max concurrent=${maxConcurrent1}, final value=${val1}`);
        console.log(`   Key2 (max=3): max concurrent=${maxConcurrent2}, final value=${val2}`);
        console.log(`   Key3 (max=5): max concurrent=${maxConcurrent3}, final value=${val3}`);
    }
    catch (err) {
        console.error('❌ Mixed max values test failed:', err.message);
        throw err;
    }
    finally {
        await new Promise(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
        try {
            fs.unlinkSync(tmpFile1);
            fs.unlinkSync(tmpFile2);
            fs.unlinkSync(tmpFile3);
        }
        catch (e) { }
    }
}
async function runAllTests() {
    console.log('========================================');
    console.log('Semaphore Test Suite (Primary Client)');
    console.log('========================================\n');
    const tests = [
        { name: 'Default max=1 (Exclusive)', fn: testDefaultMaxOne },
        { name: 'Semaphore max=3', fn: testSemaphoreMaxThree },
        { name: 'Semaphore max=10', fn: testSemaphoreMaxTen },
        { name: 'Semaphore Stress', fn: testSemaphoreStress },
        { name: 'Mixed Max Values', fn: testMixedMaxValues }
    ];
    let passed = 0;
    let failed = 0;
    for (const test of tests) {
        try {
            console.log(`\nRunning test: ${test.name}...`);
            await test.fn();
            passed++;
            console.log(`✅ ${test.name} completed`);
            await sleep(500); // Brief pause between tests
        }
        catch (err) {
            failed++;
            console.error(`\n❌ Test "${test.name}" failed:`, err.message);
        }
    }
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`Passed: ${passed}/${tests.length}`);
    console.log(`Failed: ${failed}/${tests.length}`);
    console.log('========================================\n');
    if (failed === 0) {
        console.log('✅ All semaphore tests passed!');
        process.exit(0);
    }
    else {
        console.error(`❌ ${failed} test(s) failed!`);
        process.exit(1);
    }
}
// Run tests
runAllTests().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
