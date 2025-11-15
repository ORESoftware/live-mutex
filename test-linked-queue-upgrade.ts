/**
 * Quick test to verify LinkedQueue upgrade works correctly
 * Tests the updated broker code with the new linked-queue version
 */

import {Broker, Client} from '../dist/main';
import * as assert from 'assert';

async function testBasicLockUnlock() {
    console.log('Testing basic lock/unlock with upgraded LinkedQueue...');
    
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new Broker({port});
    await broker.ensure();
    
    const client = new Client({port});
    await client.ensure();
    
    try {
        await new Promise<void>((resolve, reject) => {
            client.lock('test-key', {}, (err: any, unlock: any) => {
                if (err) return reject(err);
                
                console.log('✅ Lock acquired successfully');
                
                unlock((unlockErr: any) => {
                    if (unlockErr) return reject(unlockErr);
                    console.log('✅ Lock released successfully');
                    resolve();
                });
            });
        });
        
        console.log('✅ Basic lock/unlock test passed');
    } catch (err: any) {
        console.error('❌ Basic lock/unlock test failed:', err.message);
        throw err;
    } finally {
        await new Promise<void>(resolve => broker.close(resolve));
        client.close();
    }
}

async function testSemaphoreLock() {
    console.log('Testing semaphore lock (max=3) with upgraded LinkedQueue...');
    
    const port = 8000 + Math.floor(Math.random() * 1000);
    const broker = new Broker({port});
    await broker.ensure();
    
    const clients: Client[] = [];
    for (let i = 0; i < 5; i++) {
        const client = new Client({port});
        await client.ensure();
        clients.push(client);
    }
    
    try {
        let concurrentCount = 0;
        let maxConcurrent = 0;
        const maxHolders = 3;
        
        const promises = clients.map((client, index) => {
            return new Promise<void>((resolve, reject) => {
                client.lock('semaphore-key', {max: maxHolders}, (err: any, unlock: any) => {
                    if (err) return reject(err);
                    
                    concurrentCount++;
                    maxConcurrent = Math.max(maxConcurrent, concurrentCount);
                    
                    if (concurrentCount > maxHolders) {
                        return reject(new Error(`Semaphore limit exceeded: ${concurrentCount} > ${maxHolders}`));
                    }
                    
                    setTimeout(() => {
                        concurrentCount--;
                        unlock((unlockErr: any) => {
                            if (unlockErr) return reject(unlockErr);
                            resolve();
                        });
                    }, 50);
                });
            });
        });
        
        await Promise.all(promises);
        
        if (maxConcurrent > maxHolders) {
            throw new Error(`Semaphore limit exceeded: max concurrent was ${maxConcurrent}, limit is ${maxHolders}`);
        }
        
        console.log(`✅ Semaphore test passed (max concurrent: ${maxConcurrent})`);
    } catch (err: any) {
        console.error('❌ Semaphore test failed:', err.message);
        throw err;
    } finally {
        await new Promise<void>(resolve => broker.close(resolve));
        clients.forEach(c => c.close());
    }
}

async function runTests() {
    console.log('========================================');
    console.log('LinkedQueue Upgrade Verification Test');
    console.log('========================================\n');
    
    try {
        await testBasicLockUnlock();
        await testSemaphoreLock();
        
        console.log('\n========================================');
        console.log('✅ All upgrade verification tests passed!');
        console.log('LinkedQueue upgrade to 2.1.128 is working correctly.');
        console.log('========================================\n');
        
        process.exit(0);
    } catch (err: any) {
        console.error('\n========================================');
        console.error('❌ Upgrade verification tests failed!');
        console.error('Error:', err.message);
        console.error('========================================\n');
        process.exit(1);
    }
}

runTests();

