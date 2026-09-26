#!/usr/bin/env node

/**
 * Test connection CLI tool - verify broker connectivity and basic operations
 */

'use strict';

import {Client, RWLockWritePrefClient} from '../../src/main';

const port = parseInt(process.env.lmx_port || process.env.LMX_PORT || '6970');
const host = process.env.lmx_host || process.env.LMX_HOST || 'localhost';

async function testBasicLock() {
  console.log('Testing basic lock operations...');
  const client = new Client({port, host});
  
  try {
    await client.ensure();
    console.log('  ✅ Connected to broker');
    
    const key = `test-${Date.now()}`;
    const {key: acquiredKey, id} = await client.acquire(key, {lockRequestTimeout: 5000});
    console.log(`  ✅ Acquired lock: key="${acquiredKey}", id="${id}"`);
    
    await client.release(acquiredKey, {id});
    console.log(`  ✅ Released lock successfully`);
    
    client.close();
    return true;
  } catch (err: any) {
    console.error(`  ❌ Failed: ${err.message}`);
    client.close();
    return false;
  }
}

async function testRWLock() {
  console.log('Testing RW lock operations...');
  const client = new RWLockWritePrefClient({port, host});
  
  try {
    await client.ensure();
    console.log('  ✅ Connected to broker');
    
    const key = `rw-test-${Date.now()}`;
    
    // Test read lock
    const releaseRead = await client.acquireReadLockp(key, {lockRequestTimeout: 5000});
    console.log(`  ✅ Acquired read lock: key="${key}"`);
    await new Promise<void>((resolve, reject) => {
      releaseRead((err: any) => {
        if (err) {return reject(err);}
        resolve();
      });
    });
    console.log(`  ✅ Released read lock successfully`);
    
    // Test write lock
    const releaseWrite = await client.acquireWriteLockp(key, {lockRequestTimeout: 5000});
    console.log(`  ✅ Acquired write lock: key="${key}"`);
    await new Promise<void>((resolve, reject) => {
      releaseWrite((err: any) => {
        if (err) {return reject(err);}
        resolve();
      });
    });
    console.log(`  ✅ Released write lock successfully`);
    
    client.close();
    return true;
  } catch (err: any) {
    console.error(`  ❌ Failed: ${err.message}`);
    client.close();
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║           Live-Mutex Connection Test                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  console.log(`Testing connection to broker at ${host}:${port}\n`);
  
  let allPassed = true;
  
  if (testType === 'all' || testType === 'basic') {
    const passed = await testBasicLock();
    if (!passed) {allPassed = false;}
    console.log('');
  }
  
  if (testType === 'all' || testType === 'rw') {
    const passed = await testRWLock();
    if (!passed) {allPassed = false;}
    console.log('');
  }
  
  if (allPassed) {
    console.log('✅ All connection tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check broker is running.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

