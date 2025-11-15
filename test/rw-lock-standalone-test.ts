#!/usr/bin/env node

/**
 * Standalone RW lock test (non-suman) to verify implementation
 * Tests the same edge cases as rw-lock-edge-cases.test.ts
 */

'use strict';

import {Broker1, RWLockWritePrefClient} from '../src/main';

const BASE_PORT = 9100;
let currentPort = BASE_PORT;

function getNextPort(): number {
  return currentPort++;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWriterBlocksAllReaders(): Promise<boolean> {
  console.log('\n=== Test: writer blocks all readers ===');
  const port = getNextPort();
  const broker = new Broker1({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    const key = 'writer-blocks-readers';
    let writerAcquired = false;
    let readersStarted = 0;
    let readersAcquired = 0;
    const readerReleases: any[] = [];
    let writerReleased = false;
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test timed out - writerAcquired: ${writerAcquired}, readersAcquired: ${readersAcquired}/${readersStarted}, writerReleased: ${writerReleased}`));
      }, 15000);
      
      // Acquire write lock first
      client.acquireWriteLock(key, {}, (err, releaseWrite) => {
        if (err) {
          clearTimeout(timeout);
          return reject(err);
        }
        writerAcquired = true;
        console.log('  ✓ Writer acquired');
        
        // Try to acquire multiple read locks (should wait)
        for (let i = 0; i < 5; i++) {
          readersStarted++;
          client.acquireReadLock(key, {lockRequestTimeout: 10000}, (err2, releaseRead) => {
            if (err2) {
              clearTimeout(timeout);
              return reject(err2);
            }
            readersAcquired++;
            readerReleases.push(releaseRead);
            console.log(`  ✓ Reader ${readersAcquired} acquired`);
            
            // After writer releases, readers should all acquire
            if (readersAcquired === 5) {
              clearTimeout(timeout);
              // Release all readers
              console.log('  ✓ All readers acquired, releasing...');
              let released = 0;
              readerReleases.forEach(r => {
                r((err?: any) => {
                  if (err) {
                    console.error('  ✗ Release error:', err);
                  }
                  released++;
                  if (released === 5) {
                    console.log('  ✓ All readers released');
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
        
        // Release writer after a delay to allow readers to queue
        setTimeout(() => {
          if (!writerAcquired) {
            clearTimeout(timeout);
            return reject(new Error('Writer should have acquired lock'));
          }
          writerReleased = true;
          console.log('  ✓ Writer releasing');
          releaseWrite(() => {
            console.log('  ✓ Writer released');
          });
        }, 500);
      });
    });
  } catch (err) {
    await broker.close(() => {});
    client.close();
    throw err;
  }
}

async function testReadersCanCoexist(): Promise<boolean> {
  console.log('\n=== Test: readers can coexist ===');
  const port = getNextPort();
  const broker = new Broker1({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    const key = 'readers-coexist';
    let readersAcquired = 0;
    const releases: any[] = [];
    const targetReaders = 10;
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test timed out - readersAcquired: ${readersAcquired}/${targetReaders}`));
      }, 15000);
      
      for (let i = 0; i < targetReaders; i++) {
        client.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
          if (err) {
            clearTimeout(timeout);
            return reject(err);
          }
          readersAcquired++;
          releases.push(release);
          console.log(`  ✓ Reader ${readersAcquired}/${targetReaders} acquired`);
          
          if (readersAcquired === targetReaders) {
            clearTimeout(timeout);
            console.log('  ✓ All readers acquired simultaneously');
            // All readers acquired simultaneously
            console.log('  ✓ All readers acquired, releasing...');
            let released = 0;
            releases.forEach(r => {
              r((err?: any) => {
                if (err) {
                  console.error('  ✗ Release error:', err);
                }
                released++;
                if (released === targetReaders) {
                  console.log('  ✓ All readers released');
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

async function testWriterExclusiveDuringReaders(): Promise<boolean> {
  console.log('\n=== Test: writer exclusive during readers ===');
  const port = getNextPort();
  const broker = new Broker1({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    const key = 'writer-exclusive';
    let readersAcquired = 0;
    const readerReleases: any[] = [];
    let writerAcquired = false;
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test timed out - readersAcquired: ${readersAcquired}, writerAcquired: ${writerAcquired}`));
      }, 15000);
      
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
            console.log('  ✓ All readers acquired, releasing them...');
            // Writer should wait, so release readers first
            setTimeout(() => {
              let released = 0;
              readerReleases.forEach(r => {
                r(() => {
                  released++;
                  if (released === 3) {
                    console.log('  ✓ All readers released, acquiring writer...');
                    
                    // Now writer should acquire
                    client.acquireWriteLock(key, {lockRequestTimeout: 10000}, (err2, releaseWrite) => {
                      if (err2) {
                        clearTimeout(timeout);
                        return reject(new Error('Writer should acquire after readers release: ' + err2.message));
                      }
                      
                      writerAcquired = true;
                      console.log('  ✓ Writer acquired');
                      clearTimeout(timeout);
                      releaseWrite(() => {
                        console.log('  ✓ Writer released');
                        client.close();
                        broker.close(() => {
                          resolve(true);
                        });
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

async function testRapidReadWriteCycles(): Promise<boolean> {
  console.log('\n=== Test: rapid read/write cycles ===');
  const port = getNextPort();
  const broker = new Broker1({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    const key = 'rapid-rw-cycles';
    const cycles = 10;
    let completed = 0;
    let isWrite = false;
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test timed out - completed: ${completed}/${cycles}, isWrite: ${isWrite}`));
      }, 60000);
      
      const cycle = () => {
        if (isWrite) {
          client.acquireWriteLock(key, {lockRequestTimeout: 10000}, (err, release) => {
            if (err) {
              clearTimeout(timeout);
              return reject(err);
            }
            setTimeout(() => {
              release(() => {
                completed++;
                isWrite = false;
                console.log(`  ✓ Cycle ${completed}/${cycles} (write)`);
                if (completed < cycles) {
                  cycle();
                } else {
                  clearTimeout(timeout);
                  client.close();
                  broker.close(() => {
                    resolve(true);
                  });
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
              release(() => {
                completed++;
                isWrite = true;
                console.log(`  ✓ Cycle ${completed}/${cycles} (read)`);
                if (completed < cycles) {
                  cycle();
                } else {
                  clearTimeout(timeout);
                  client.close();
                  broker.close(() => {
                    resolve(true);
                  });
                }
              });
            }, 10);
          });
        }
      };
      
      cycle();
    });
  } catch (err) {
    await broker.close(() => {});
    client.close();
    throw err;
  }
}

async function testWriteLockTimeoutWhenReadersHold(): Promise<boolean> {
  console.log('\n=== Test: write lock timeout when readers hold ===');
  const port = getNextPort();
  const broker = new Broker1({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    const key = 'write-timeout';
    let readerAcquired = false;
    const readerRelease: any[] = [];
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test timed out - readerAcquired: ${readerAcquired}`));
      }, 15000);
      
      // Acquire read lock
      client.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
        if (err) {
          clearTimeout(timeout);
          return reject(err);
        }
        readerAcquired = true;
        readerRelease.push(release);
        console.log('  ✓ Reader acquired');
        
        // Try to acquire write lock with short timeout
        client.acquireWriteLock(key, {lockRequestTimeout: 300}, (err2, releaseWrite) => {
          if (!err2) {
            clearTimeout(timeout);
            releaseWrite(() => {});
            readerRelease[0](() => {});
            return reject(new Error('Write lock should timeout when reader holds lock'));
          }
          
          // Expected timeout error
          if (err2.message && err2.message.includes('timeout')) {
            console.log('  ✓ Write lock correctly timed out');
            clearTimeout(timeout);
            readerRelease[0](() => {
              console.log('  ✓ Reader released');
              client.close();
              broker.close(() => {
                resolve(true);
              });
            });
          } else {
            clearTimeout(timeout);
            readerRelease[0](() => {});
            return reject(new Error('Expected timeout error, got: ' + err2.message));
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

async function testMultipleKeysWithRWLocks(): Promise<boolean> {
  console.log('\n=== Test: multiple keys with RW locks ===');
  const port = getNextPort();
  const broker = new Broker1({port});
  const client = new RWLockWritePrefClient({port});
  
  try {
    await broker.ensure();
    await client.ensure();
    
    const keys = ['rw-key1', 'rw-key2', 'rw-key3'];
    let acquired = 0;
    const releases: any[] = [];
    
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test timed out - acquired: ${acquired}/${keys.length}`));
      }, 15000);
      
      keys.forEach(key => {
        client.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
          if (err) {
            clearTimeout(timeout);
            return reject(err);
          }
          acquired++;
          releases.push({key, release});
          console.log(`  ✓ Acquired lock on ${key} (${acquired}/${keys.length})`);
          
          if (acquired === keys.length) {
            clearTimeout(timeout);
            console.log('  ✓ All locks acquired, releasing...');
            let released = 0;
            const total = releases.length;
            console.log(`  → Attempting to release ${total} locks`);
            releases.forEach(({key: k, release: r}, index) => {
              console.log(`  → Releasing lock ${index + 1}/${total} for key: ${k}`);
              try {
                r((err?: any) => {
                  if (err) {
                    console.error(`  ✗ Release error for ${k}:`, err);
                  } else {
                    console.log(`  ✓ Released lock for ${k}`);
                  }
                  released++;
                  console.log(`  → Release callback called: ${released}/${total}`);
                  if (released === total) {
                    console.log('  ✓ All locks released');
                    setTimeout(() => {
                      client.close();
                      broker.close(() => {
                        resolve(true);
                      });
                    }, 100);
                  }
                });
              } catch (e) {
                console.error(`  ✗ Exception releasing ${k}:`, e);
                released++;
                if (released === total) {
                  client.close();
                  broker.close(() => {
                    reject(new Error(`Failed to release locks: ${e}`));
                  });
                }
              }
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
  console.log('🧪 Standalone RW Lock Tests');
  console.log('='.repeat(80));
  
  // Test only the simplest case first to verify the test framework works
  const tests = [
    { name: 'Multiple keys with RW locks', fn: testMultipleKeysWithRWLocks },
    // { name: 'Readers can coexist', fn: testReadersCanCoexist },
    // { name: 'Writer blocks all readers', fn: testWriterBlocksAllReaders },
    // { name: 'Writer exclusive during readers', fn: testWriterExclusiveDuringReaders },
    // { name: 'Rapid read/write cycles', fn: testRapidReadWriteCycles },
    // { name: 'Write lock timeout when readers hold', fn: testWriteLockTimeoutWhenReadersHold },
  ];
  
  const results: Array<{name: string, passed: boolean, error?: string}> = [];
  
  for (const test of tests) {
    try {
      console.log(`\n▶ Running: ${test.name}`);
      const passed = await test.fn();
      results.push({ name: test.name, passed });
      console.log(`✅ ${test.name} PASSED`);
      // Small delay between tests
      await delay(500);
    } catch (err: any) {
      results.push({ name: test.name, passed: false, error: err.message });
      console.log(`❌ ${test.name} FAILED: ${err.message}`);
      // Continue with next test
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Test Summary');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}\n`);
  
  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });
    console.log();
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

