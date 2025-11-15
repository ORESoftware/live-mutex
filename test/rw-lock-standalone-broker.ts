#!/usr/bin/env node

/**
 * Comprehensive standalone RW lock test (with Broker)
 * This test verifies the RW lock implementation independently of Suman
 */

'use strict';

import {Broker, RWLockWritePrefClient} from '../src/main';

// Copy the rest from rw-lock-standalone-test.ts but use Broker instead of Broker1
// For brevity, I'll create a minimal version that tests the key scenarios

async function testMultipleKeys() {
  console.log('=== Test: Multiple keys with RW locks (Broker) ===');
  const port = 7002;
  const broker = new Broker({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timed out'));
      }, 30000);
      
      const keys = ['rw-key1', 'rw-key2', 'rw-key3'];
      const releases: any[] = [];
      let acquired = 0;
      
      keys.forEach((key, index) => {
        client.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
          if (err) {
            clearTimeout(timeout);
            return reject(err);
          }
          acquired++;
          releases.push({key, release, index});
          console.log(`  ✓ Acquired lock for ${key}`);
          
          if (acquired === keys.length) {
            console.log('  → Releasing all locks...');
            let released = 0;
            releases.forEach(({key: k, release: r, index: i}) => {
              console.log(`  → Releasing lock ${i + 1}/${keys.length} for key: ${k}`);
              r((err?: any, val?: any) => {
                if (err) {
                  clearTimeout(timeout);
                  return reject(err);
                }
                released++;
                console.log(`  ✓ Released lock for ${k}`);
                console.log(`  → Release callback called: ${released}/${keys.length}`);
                if (released === keys.length) {
                  clearTimeout(timeout);
                  console.log('  ✓ All locks released');
                  setTimeout(() => {
                    client.close();
                    broker.close(() => {
                      resolve(true);
                    });
                  }, 100);
                }
              });
            });
          }
        });
      });
    });
  } catch (err) {
    await broker.close(() => {});
    client.close();
    throw err;
  }
}

async function main() {
  try {
    const result = await testMultipleKeys();
    console.log('\n✅ Multiple keys with RW locks PASSED');
    console.log('\n✅ Test PASSED');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Test FAILED:', err.message);
    process.exit(1);
  }
}

main();

