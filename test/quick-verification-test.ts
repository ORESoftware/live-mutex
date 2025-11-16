#!/usr/bin/env node
'use strict';

/**
 * Quick verification test - tests all our fixes with a real broker
 */

const {Client, Broker1, LMXClientLockException, LMXClientUnlockException, LMXLockRequestError, LMXUnlockRequestError} = require('../dist/main');

const PORT = 8003;

async function runQuickVerification() {
    console.log('🔍 Quick Verification Test\n');
    
    // Test 1: Exception classes
    console.log('Test 1: Exception classes extend Error');
    const lockErr = new LMXClientLockException('key', 'id', LMXLockRequestError.InternalError, 'test');
    const unlockErr = new LMXClientUnlockException('key', 'id', LMXUnlockRequestError.InternalError, 'test');
    console.log('  ✅ LMXClientLockException instanceof Error:', lockErr instanceof Error);
    console.log('  ✅ LMXClientUnlockException instanceof Error:', unlockErr instanceof Error);
    console.log('  ✅ Names:', lockErr.name, unlockErr.name);
    
    // Test 2: Start broker and client
    console.log('\nTest 2: Starting broker and client');
    const broker = new Broker1({port: PORT});
    await new Promise<void>((resolve, reject) => {
        broker.ensure((err: any) => {
            if (err) return reject(err);
            resolve();
        });
    });
    console.log('  ✅ Broker started');
    
    const client = new Client({port: PORT});
    await new Promise<void>((resolve, reject) => {
        client.ensure((err: any) => {
            if (err) return reject(err);
            resolve();
        });
    });
    console.log('  ✅ Client connected');
    
    // Test 3: Lock with callback only
    console.log('\nTest 3: lock(key, callback)');
    await new Promise<void>((resolve, reject) => {
        client.lock('test-key-1', (err: any, result: any) => {
            if (err) return reject(err);
            console.log('  ✅ Lock acquired, id:', result.id);
            client.unlock('test-key-1', result.id, (unlockErr: any) => {
                if (unlockErr) return reject(unlockErr);
                console.log('  ✅ Unlock with string id works');
                resolve();
            });
        });
    });
    
    // Test 4: Lock with number ttl
    console.log('\nTest 4: lock(key, ttl, callback) - legacy signature');
    await new Promise<void>((resolve, reject) => {
        // @ts-ignore - testing legacy signature
        client.lock('test-key-2', 1000, (err: any, result: any) => {
            if (err) return reject(err);
            console.log('  ✅ Lock with number ttl works');
            client.unlock('test-key-2', result.id, resolve);
        });
    });
    
    // Test 5: Lock with options
    console.log('\nTest 5: lock(key, options, callback)');
    await new Promise<void>((resolve, reject) => {
        client.lock('test-key-3', {ttl: 5000}, (err: any, result: any) => {
            if (err) return reject(err);
            console.log('  ✅ Lock with options works');
            client.unlock('test-key-3', result.id, resolve);
        });
    });
    
    // Test 6: Unlock with string id
    console.log('\nTest 6: unlock(key, id, callback)');
    await new Promise<void>((resolve, reject) => {
        client.lock('test-key-4', (err: any, result: any) => {
            if (err) return reject(err);
            const lockId = result.id;
            client.unlock('test-key-4', lockId, (unlockErr: any) => {
                if (unlockErr) return reject(unlockErr);
                console.log('  ✅ Unlock with string id works');
                resolve();
            });
        });
    });
    
    // Test 7: Unlock with options object
    console.log('\nTest 7: unlock(key, {id}, callback)');
    await new Promise<void>((resolve, reject) => {
        client.lock('test-key-5', (err: any, result: any) => {
            if (err) return reject(err);
            client.unlock('test-key-5', {id: result.id}, (unlockErr: any) => {
                if (unlockErr) return reject(unlockErr);
                console.log('  ✅ Unlock with options object works');
                resolve();
            });
        });
    });
    
    // Test 8: Promise-based unlockp with string id
    console.log('\nTest 8: unlockp(key, id) - promise with string id');
    const lockResult = await client.lockp('test-key-6');
    console.log('  ✅ Lock acquired via promise, id:', lockResult.id);
    await client.unlockp('test-key-6', lockResult.id);
    console.log('  ✅ Unlockp with string id works');
    
    // Test 9: Promise-based unlockp with boolean
    console.log('\nTest 9: unlockp(key, true) - promise with boolean');
    await client.lockp('test-key-7');
    await client.unlockp('test-key-7', true);
    console.log('  ✅ Unlockp with boolean works');
    
    // Test 10: Promise-based unlockp with options
    console.log('\nTest 10: unlockp(key, {id}) - promise with options');
    const lockResult2 = await client.lockp('test-key-8');
    await client.unlockp('test-key-8', {id: lockResult2.id});
    console.log('  ✅ Unlockp with options works');
    
    // Cleanup
    console.log('\nCleaning up...');
    client.close();
    await new Promise<void>((resolve) => {
        broker.close(() => resolve());
    });
    console.log('  ✅ Cleanup complete\n');
    
    console.log('✅ All verification tests passed!');
}

runQuickVerification().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});

