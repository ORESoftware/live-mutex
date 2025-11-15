#!/usr/bin/env node

/**
 * Simple RW lock test to verify basic functionality
 */

'use strict';

import {Broker1, RWLockWritePrefClient} from '../src/main';

async function testSimpleReadLock() {
  console.log('=== Simple Read Lock Test ===');
  const port = 9200;
  const broker = new Broker1({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timed out'));
      }, 10000);
      
      console.log('  → Acquiring read lock...');
      client.acquireReadLock('test-key', {}, (err, release) => {
        if (err) {
          clearTimeout(timeout);
          return reject(err);
        }
        console.log('  ✓ Read lock acquired');
        
        console.log('  → Releasing read lock...');
        release((releaseErr?: any) => {
          clearTimeout(timeout);
          if (releaseErr) {
            console.error('  ✗ Release error:', releaseErr);
            return reject(releaseErr);
          }
          console.log('  ✓ Read lock released');
          
          setTimeout(() => {
            client.close();
            broker.close(() => {
              resolve(true);
            });
          }, 100);
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
    const result = await testSimpleReadLock();
    console.log('\n✅ Test PASSED');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Test FAILED:', err.message);
    process.exit(1);
  }
}

main();

