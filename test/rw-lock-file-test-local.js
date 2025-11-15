"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const os = require("os");
const main_1 = require("../dist/main");
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
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    const client = new main_1.RWLockWritePrefClient({ port });
    await client.ensure();
    const tmpFile = createTempFile();
    console.log('Using temp file:', tmpFile);
    try {
        await new Promise((resolve, reject) => {
            client.acquireWriteLock('test-key', {}, (err, release) => {
                if (err)
                    return reject(err);
                writeFile(tmpFile, 100);
                const value = readFile(tmpFile);
                if (value !== 100) {
                    return reject(new Error(`Expected 100, got ${value}`));
                }
                release((releaseErr) => {
                    if (releaseErr)
                        return reject(releaseErr);
                    resolve();
                });
            });
        });
        await new Promise((resolve, reject) => {
            client.acquireReadLock('test-key', {}, (err, release) => {
                if (err)
                    return reject(err);
                const value = readFile(tmpFile);
                if (value !== 100) {
                    return reject(new Error(`Expected 100, got ${value}`));
                }
                release((releaseErr) => {
                    if (releaseErr)
                        return reject(releaseErr);
                    resolve();
                });
            });
        });
        console.log('✅ Basic RWLock test passed');
    }
    catch (err) {
        console.error('❌ Basic RWLock test failed:', err.message);
        throw err;
    }
    finally {
        await new Promise(resolve => broker.close(resolve));
        client.close();
        try {
            fs.unlinkSync(tmpFile);
        }
        catch (e) { }
    }
}
async function testConcurrentReaders() {
    console.log('\n=== Test 2: Concurrent Readers ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    const clients = [];
    for (let i = 0; i < 5; i++) {
        const client = new main_1.RWLockWritePrefClient({ port });
        await client.ensure();
        clients.push(client);
    }
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    try {
        const readPromises = clients.map((client, index) => {
            return new Promise((resolve, reject) => {
                client.acquireReadLock('read-key', {}, (err, release) => {
                    if (err)
                        return reject(err);
                    const value = readFile(tmpFile);
                    console.log(`  Reader ${index} read value: ${value}`);
                    setTimeout(() => {
                        release((releaseErr) => {
                            if (releaseErr)
                                return reject(releaseErr);
                            resolve();
                        });
                    }, 10);
                });
            });
        });
        await Promise.all(readPromises);
        console.log('✅ Concurrent readers test passed - all readers accessed simultaneously');
    }
    catch (err) {
        console.error('❌ Concurrent readers test failed:', err.message);
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
async function testExclusiveWriter() {
    console.log('\n=== Test 3: Exclusive Writer ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    const clients = [];
    for (let i = 0; i < 3; i++) {
        const client = new main_1.RWLockWritePrefClient({ port });
        await client.ensure();
        clients.push(client);
    }
    const tmpFile = createTempFile();
    writeFile(tmpFile, 0);
    console.log('Using temp file:', tmpFile);
    try {
        let writeCount = 0;
        const writePromises = clients.map((client, index) => {
            return new Promise((resolve, reject) => {
                client.acquireWriteLock('write-key', {}, (err, release) => {
                    if (err)
                        return reject(err);
                    writeCount++;
                    if (writeCount > 1) {
                        return reject(new Error(`Multiple writers detected! Count: ${writeCount}`));
                    }
                    const currentValue = readFile(tmpFile);
                    const newValue = currentValue + 1;
                    writeFile(tmpFile, newValue);
                    console.log(`  Writer ${index} wrote value: ${newValue}`);
                    setTimeout(() => {
                        writeCount--;
                        release((releaseErr) => {
                            if (releaseErr)
                                return reject(releaseErr);
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
    }
    catch (err) {
        console.error('❌ Exclusive writer test failed:', err.message);
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
async function testReaderWriterInteraction() {
    console.log('\n=== Test 4: Reader-Writer Interaction ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new main_1.Broker({ port });
    await broker.ensure();
    const readerClient = new main_1.RWLockWritePrefClient({ port });
    await readerClient.ensure();
    const writerClient = new main_1.RWLockWritePrefClient({ port });
    await writerClient.ensure();
    const tmpFile = createTempFile();
    writeFile(tmpFile, 100);
    console.log('Using temp file:', tmpFile);
    try {
        const readerPromise = new Promise((resolve, reject) => {
            readerClient.acquireReadLock('rw-key', {}, (err, release) => {
                if (err)
                    return reject(err);
                console.log('  Reader acquired lock');
                const value1 = readFile(tmpFile);
                console.log(`  Reader read value: ${value1}`);
                setTimeout(() => {
                    const value2 = readFile(tmpFile);
                    console.log(`  Reader read value again: ${value2}`);
                    release((releaseErr) => {
                        if (releaseErr)
                            return reject(releaseErr);
                        console.log('  Reader released lock');
                        resolve();
                    });
                }, 100);
            });
        });
        await sleep(20);
        const writerPromise = new Promise((resolve, reject) => {
            writerClient.acquireWriteLock('rw-key', {}, (err, release) => {
                if (err)
                    return reject(err);
                console.log('  Writer acquired lock (after reader released)');
                const currentValue = readFile(tmpFile);
                writeFile(tmpFile, currentValue + 50);
                const newValue = readFile(tmpFile);
                console.log(`  Writer wrote value: ${newValue}`);
                release((releaseErr) => {
                    if (releaseErr)
                        return reject(releaseErr);
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
    }
    catch (err) {
        console.error('❌ Reader-writer interaction test failed:', err.message);
        throw err;
    }
    finally {
        await new Promise(resolve => broker.close(resolve));
        readerClient.close();
        writerClient.close();
        try {
            fs.unlinkSync(tmpFile);
        }
        catch (e) { }
    }
}
async function testSemaphoreLogic() {
    console.log('\n=== Test 5: Semaphore Logic ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
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
    console.log('Testing semaphore with max=3 (should allow 3 concurrent holders)');
    try {
        let concurrentCount = 0;
        let maxConcurrent = 0;
        const maxHolders = 3;
        const semaphorePromises = clients.map((client, index) => {
            return new Promise((resolve, reject) => {
                client.lock('semaphore-key', { max: maxHolders }, (err, unlock) => {
                    if (err)
                        return reject(err);
                    concurrentCount++;
                    maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                    if (concurrentCount > maxHolders) {
                        return reject(new Error(`Semaphore limit exceeded! Count: ${concurrentCount}, Max: ${maxHolders}`));
                    }
                    console.log(`  Client ${index} acquired semaphore (concurrent: ${concurrentCount})`);
                    const currentValue = readFile(tmpFile);
                    writeFile(tmpFile, currentValue + 1);
                    setTimeout(() => {
                        concurrentCount--;
                        unlock((unlockErr) => {
                            if (unlockErr)
                                return reject(unlockErr);
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
    }
    catch (err) {
        console.error('❌ Semaphore test failed:', err.message);
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
    console.log('\n=== Test 6: Semaphore Stress Test ===');
    const port = 8000 + Math.floor(Math.random() * 1000);
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
                    client.lock('stress-semaphore', { max: maxHolders }, (err, unlock) => {
                        if (err)
                            return reject(err);
                        concurrentCount++;
                        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                        if (concurrentCount > maxHolders) {
                            return reject(new Error(`Semaphore limit exceeded! Count: ${concurrentCount}, Max: ${maxHolders}`));
                        }
                        totalOperations++;
                        const currentValue = readFile(tmpFile);
                        writeFile(tmpFile, currentValue + 1);
                        setTimeout(() => {
                            concurrentCount--;
                            unlock((unlockErr) => {
                                if (unlockErr)
                                    return reject(unlockErr);
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
async function runAllTests() {
    console.log('========================================');
    console.log('Read-Write Lock & Semaphore Test Suite');
    console.log('========================================\n');
    const tests = [
        { name: 'Basic RWLock', fn: testBasicRWLock },
        { name: 'Concurrent Readers', fn: testConcurrentReaders },
        { name: 'Exclusive Writer', fn: testExclusiveWriter },
        { name: 'Reader-Writer Interaction', fn: testReaderWriterInteraction },
        { name: 'Semaphore Logic', fn: testSemaphoreLogic },
        { name: 'Semaphore Stress', fn: testSemaphoreStress }
    ];
    let passed = 0;
    let failed = 0;
    for (const test of tests) {
        try {
            await test.fn();
            passed++;
            await sleep(500);
        }
        catch (err) {
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
    }
    else {
        console.error(`❌ ${failed} test(s) failed!`);
        process.exit(1);
    }
}
runAllTests().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
