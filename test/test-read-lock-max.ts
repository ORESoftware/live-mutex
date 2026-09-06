#!/usr/bin/env node
'use strict';

/**
 * Test that read locks honor explicit max values
 * - Default should be 10 concurrent readers
 * - Explicit max=1 should be honored (only 1 reader at a time)
 * - Explicit max=5 should be honored (up to 5 readers at a time)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Broker1, RWLockWritePrefClient } from '../dist/main';

const PORT = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : 3334;
const TEST_FILE = path.join(os.tmpdir(), 'lmx-read-max-test.txt');

function log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`);
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

async function testDefaultMax10(): Promise<boolean> {
    log('Test 1: Default max should allow 10 concurrent readers');
    const broker = new Broker1({port: PORT});
    await broker.ensure();
    
    const clients: RWLockWritePrefClient[] = [];
    for (let i = 0; i < 12; i++) {
        const client = new RWLockWritePrefClient({port: PORT});
        await client.ensure();
        clients.push(client);
    }
    
    try {
        writeFile('TEST');
        const key = 'test-default-max';
        let concurrentCount = 0;
        let maxConcurrent = 0;
        const promises: Promise<void>[] = [];
        
        // Try to acquire 12 read locks - should allow at least 10 concurrently
        for (let i = 0; i < 12; i++) {
            promises.push(
                new Promise<void>((resolve, reject) => {
                    clients[i].acquireReadLock(key, {}, (err: any, release: any) => {
                        if (err) return reject(err);
                        
                        concurrentCount++;
                        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                        log(`Reader ${i} acquired (concurrent: ${concurrentCount}, max: ${maxConcurrent})`);
                        
                        setTimeout(() => {
                            concurrentCount--;
                            release(() => {
                                log(`Reader ${i} released (concurrent: ${concurrentCount})`);
                                resolve();
                            });
                        }, 100);
                    });
                })
            );
        }
        
        await Promise.all(promises);
        
        log(`Test 1 result: maxConcurrent=${maxConcurrent}, expected: >= 10`);
        return maxConcurrent >= 10;
    } finally {
        clients.forEach(c => c.close());
        await new Promise<void>(resolve => broker.close(() => resolve()));
    }
}

async function testExplicitMax1(): Promise<boolean> {
    log('Test 2: Explicit max=1 should only allow 1 reader at a time');
    const broker = new Broker1({port: PORT + 1});
    await broker.ensure();
    
    const clients: RWLockWritePrefClient[] = [];
    for (let i = 0; i < 5; i++) {
        const client = new RWLockWritePrefClient({port: PORT + 1});
        await client.ensure();
        clients.push(client);
    }
    
    try {
        writeFile('TEST');
        const key = 'test-max-1';
        let concurrentCount = 0;
        let maxConcurrent = 0;
        let violations = 0;
        const promises: Promise<void>[] = [];
        
        // Try to acquire 5 read locks with max=1 - should only allow 1 at a time
        for (let i = 0; i < 5; i++) {
            promises.push(
                new Promise<void>((resolve, reject) => {
                    clients[i].acquireReadLock(key, {max: 1}, (err: any, release: any) => {
                        if (err) return reject(err);
                        
                        concurrentCount++;
                        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                        
                        if (concurrentCount > 1) {
                            violations++;
                            log(`⚠️  VIOLATION: ${concurrentCount} concurrent readers (expected max 1)`);
                        }
                        
                        log(`Reader ${i} acquired (concurrent: ${concurrentCount}, max: ${maxConcurrent})`);
                        
                        setTimeout(() => {
                            concurrentCount--;
                            release(() => {
                                log(`Reader ${i} released (concurrent: ${concurrentCount})`);
                                resolve();
                            });
                        }, 50);
                    });
                })
            );
        }
        
        await Promise.all(promises);
        
        log(`Test 2 result: maxConcurrent=${maxConcurrent}, violations=${violations}, expected: maxConcurrent=1, violations=0`);
        return maxConcurrent === 1 && violations === 0;
    } finally {
        clients.forEach(c => c.close());
        await new Promise<void>(resolve => broker.close(() => resolve()));
    }
}

async function testExplicitMax5(): Promise<boolean> {
    log('Test 3: Explicit max=5 should allow up to 5 concurrent readers');
    const broker = new Broker1({port: PORT + 2});
    await broker.ensure();
    
    const clients: RWLockWritePrefClient[] = [];
    for (let i = 0; i < 8; i++) {
        const client = new RWLockWritePrefClient({port: PORT + 2});
        await client.ensure();
        clients.push(client);
    }
    
    try {
        writeFile('TEST');
        const key = 'test-max-5';
        let concurrentCount = 0;
        let maxConcurrent = 0;
        let violations = 0;
        const promises: Promise<void>[] = [];
        
        // Try to acquire 8 read locks with max=5 - should allow up to 5 concurrently
        for (let i = 0; i < 8; i++) {
            promises.push(
                new Promise<void>((resolve, reject) => {
                    clients[i].acquireReadLock(key, {max: 5}, (err: any, release: any) => {
                        if (err) return reject(err);
                        
                        concurrentCount++;
                        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                        
                        if (concurrentCount > 5) {
                            violations++;
                            log(`⚠️  VIOLATION: ${concurrentCount} concurrent readers (expected max 5)`);
                        }
                        
                        log(`Reader ${i} acquired (concurrent: ${concurrentCount}, max: ${maxConcurrent})`);
                        
                        setTimeout(() => {
                            concurrentCount--;
                            release(() => {
                                log(`Reader ${i} released (concurrent: ${concurrentCount})`);
                                resolve();
                            });
                        }, 50);
                    });
                })
            );
        }
        
        await Promise.all(promises);
        
        log(`Test 3 result: maxConcurrent=${maxConcurrent}, violations=${violations}, expected: maxConcurrent=5, violations=0`);
        return maxConcurrent === 5 && violations === 0;
    } finally {
        clients.forEach(c => c.close());
        await new Promise<void>(resolve => broker.close(() => resolve()));
    }
}

async function runTests(): Promise<void> {
    log('=== Testing Read Lock Max Value Handling ===\n');
    
    const results: {name: string; passed: boolean}[] = [];
    
    try {
        const test1 = await testDefaultMax10();
        results.push({name: 'Default max=10', passed: test1});
        await delay(500);
        
        const test2 = await testExplicitMax1();
        results.push({name: 'Explicit max=1 honored', passed: test2});
        await delay(500);
        
        const test3 = await testExplicitMax5();
        results.push({name: 'Explicit max=5 honored', passed: test3});
        
    } catch (error: any) {
        log('Test suite error:', error.message);
        throw error;
    } finally {
        // Clean up test file
        try {
            if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
        } catch (err) {
            // Ignore
        }
    }
    
    // Summary
    log('\n=== Test Summary ===');
    results.forEach(r => {
        const status = r.passed ? '✅' : '❌';
        log(`${status} ${r.name}`);
    });
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    log(`\nTotal: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
    
    if (failed > 0) {
        throw new Error(`${failed} test(s) failed`);
    }
    
    log('\n✅ All max value tests passed!');
}

if (require.main === module) {
    runTests()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('\n❌ Test suite failed:', err);
            process.exit(1);
        });
}

export { runTests };

