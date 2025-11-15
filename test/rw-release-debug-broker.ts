#!/usr/bin/env node

/**
 * Debug test for RW lock release issues (with Broker)
 */

'use strict';

import {Broker, RWLockWritePrefClient} from '../src/main';

async function testMultipleReleases() {
  console.log('=== Test: Multiple rapid releases (Broker) ===');
  const port = 9401;
  const broker = new Broker({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timed out'));
      }, 15000);
      
      const key = 'test-key';
      const releases: any[] = [];
      let acquired = 0;
      const target = 3;
      
      // Acquire multiple read locks
      for (let i = 0; i < target; i++) {
        client.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
          if (err) {
            clearTimeout(timeout);
            return reject(err);
          }
          acquired++;
          releases.push(release);
          console.log(`  ✓ Acquired lock ${acquired}/${target}`);
          
          if (acquired === target) {
            console.log('  → Releasing all locks...');
            let released = 0;
            releases.forEach((r, index) => {
              console.log(`  → Releasing lock ${index + 1}/${target}`);
              r((err?: any, val?: any) => {
                if (err) {
                  console.error(`  ✗ Release error for lock ${index + 1}:`, err);
                  clearTimeout(timeout);
                  return reject(err);
                }
                released++;
                console.log(`  ✓ Released lock ${index + 1}/${target} (${released}/${target} total)`);
                if (released === target) {
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
      }
    });
  } catch (err) {
    await broker.close(() => {});
    client.close();
    throw err;
  }
}

async function main() {
  try {
    const result = await testMultipleReleases();
    console.log('\n✅ Test PASSED');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Test FAILED:', err.message);
    process.exit(1);
  }
}

main();

