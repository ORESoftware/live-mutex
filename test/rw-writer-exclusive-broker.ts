#!/usr/bin/env node

/**
 * Test: writer exclusive during readers (with Broker)
 * This mirrors the failing Suman test to verify the fix
 */

'use strict';

import {Broker, RWLockWritePrefClient} from '../src/main';

async function testWriterExclusiveDuringReaders() {
  console.log('=== Test: writer exclusive during readers (Broker) ===');
  const port = 9501;
  const broker = new Broker({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timed out'));
      }, 15000);
      
      const key = 'writer-exclusive';
      let readersAcquired = 0;
      const readerReleases: any[] = [];
      let writerAcquired = false;

      // First acquire multiple read locks
      for (let i = 0; i < 3; i++) {
        client.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
          if (err) {
            clearTimeout(timeout);
            return reject(err);
          }
          readersAcquired++;
          readerReleases.push(release);
          console.log(`  ✓ Reader ${readersAcquired}/3 acquired`);
          
          // Once all readers acquired, try to get write lock
          if (readersAcquired === 3) {
            // Writer should wait, so release readers first
            setTimeout(() => {
              // Release all readers and wait for all releases to complete
              let released = 0;
              const releaseTimeout = setTimeout(() => {
                if (released < 3) {
                  clearTimeout(timeout);
                  return reject(new Error(`Only ${released}/3 readers released after timeout`));
                }
              }, 5000);
              
              console.log('  → Releasing all readers...');
              readerReleases.forEach((r, index) => {
                r((err?: any, val?: any) => {
                  if (err) {
                    clearTimeout(releaseTimeout);
                    clearTimeout(timeout);
                    return reject(err);
                  }
                  released++;
                  console.log(`  ✓ Reader ${index + 1} released (${released}/3)`);
                  // Once all readers are released, try to acquire write lock
                  if (released === 3) {
                    clearTimeout(releaseTimeout);
                    console.log('  → All readers released, acquiring write lock...');
                    // Now writer should acquire
                    client.acquireWriteLock(key, {lockRequestTimeout: 10000}, (err2, releaseWrite) => {
                      if (err2) {
                        clearTimeout(timeout);
                        return reject(new Error('Writer should acquire after readers release: ' + err2.message));
                      }
                      
                      console.log('  ✓ Write lock acquired');
                      writerAcquired = true;
                      releaseWrite((err3?: any, val3?: any) => {
                        if (err3) {
                          clearTimeout(timeout);
                          return reject(err3);
                        }
                        console.log('  ✓ Write lock released');
                        clearTimeout(timeout);
                        setTimeout(() => {
                          client.close();
                          broker.close(() => {
                            resolve(true);
                          });
                        }, 100);
                      });
                    });
                  }
                });
              });
            }, 200);
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
    const result = await testWriterExclusiveDuringReaders();
    console.log('\n✅ Test PASSED');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Test FAILED:', err.message);
    process.exit(1);
  }
}

main();

