#!/usr/bin/env node

/**
 * Test: rapid read/write cycles
 * This mirrors the failing Suman test to verify the fix
 */

'use strict';

import {Broker1, RWLockWritePrefClient} from '../src/main';

async function testRapidReadWriteCycles() {
  console.log('=== Test: rapid read/write cycles ===');
  const port = 9600;
  const broker = new Broker1({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timed out'));
      }, 60000);
      
      const key = 'rapid-rw-cycles';
      const cycles = 10;
      let completed = 0;
      let isWrite = false;

      const cycle = () => {
        if (isWrite) {
          client.acquireWriteLock(key, {lockRequestTimeout: 10000}, (err, release) => {
            if (err) {
              clearTimeout(timeout);
              return reject(err);
            }
            setTimeout(() => {
              release((err?: any, val?: any) => {
                if (err) {
                  clearTimeout(timeout);
                  return reject(err);
                }
                completed++;
                isWrite = false;
                console.log(`  ✓ Cycle ${completed}/${cycles * 2} (write)`);
                if (completed >= cycles * 2) {
                  clearTimeout(timeout);
                  console.log('  ✓ All cycles completed');
                  setTimeout(() => {
                    client.close();
                    broker.close(() => {
                      resolve(true);
                    });
                  }, 100);
                } else if (completed < cycles * 2) {
                  cycle();
                }
              });
            }, 10);
          });
        } else {
          client.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
            if (err) {
              clearTimeout(timeout);
              return reject(err);
            }
            setTimeout(() => {
              release((err?: any, val?: any) => {
                if (err) {
                  clearTimeout(timeout);
                  return reject(err);
                }
                completed++;
                isWrite = true;
                console.log(`  ✓ Cycle ${completed}/${cycles * 2} (read)`);
                if (completed >= cycles * 2) {
                  clearTimeout(timeout);
                  console.log('  ✓ All cycles completed');
                  setTimeout(() => {
                    client.close();
                    broker.close(() => {
                      resolve(true);
                    });
                  }, 100);
                } else if (completed < cycles * 2) {
                  cycle();
                }
              });
            }, 10);
          });
        }
      };

      console.log(`  → Starting ${cycles * 2} cycles (${cycles} read + ${cycles} write)...`);
      cycle();
    });
  } catch (err) {
    await broker.close(() => {});
    client.close();
    throw err;
  }
}

async function main() {
  try {
    const result = await testRapidReadWriteCycles();
    console.log('\n✅ Test PASSED');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Test FAILED:', err.message);
    process.exit(1);
  }
}

main();

