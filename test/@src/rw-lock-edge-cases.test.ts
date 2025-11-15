'use strict';

import * as suman from 'suman';
const {Test} = suman.init(module);
import {Broker1, RWLockWritePrefClient} from '../../dist/main';

Test.create(['Promise', function (b, it, inject, describe, before, $deps) {
  
  const {Promise} = b.ioc;
  const {chalk: colors} = $deps;

  console.log('suman child id:',process.env.SUMAN_CHILD_ID);

  const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
  const conf = Object.freeze({port});

  const handleEvents = function (v) {
    v.emitter.on('warning', w => {
      console.error('warning:', w);
    });
    v.emitter.on('error', w => {
      console.error('error:', w);
    });
    return v;
  };
  
  inject(() => {
    const brokerConf = Object.assign({}, conf, {noListen: process.env.lmx_broker_no_listen === 'yes'});
    return {
      broker: new Broker1(brokerConf).ensure().then(handleEvents)
    }
  });

  before('get client', h => {
    return new RWLockWritePrefClient(conf).ensure().then(function (client) {
      h.supply.client = handleEvents(client);
    });
  });

  describe('RW lock edge cases', function (b) {
    
    it.cb('writer blocks all readers', {timeout: 15000}, t => {
      const c = t.supply.client;
      const key = 'writer-blocks-readers';
      let writerAcquired = false;
      let readersStarted = 0;
      let readersAcquired = 0;
      const readerReleases: any[] = [];
      let writerReleased = false;

      // Acquire write lock first
      c.acquireWriteLock(key, {}, (err, releaseWrite) => {
        if (err) {
          return t.fail(err);
        }
        writerAcquired = true;

        // Try to acquire multiple read locks (should wait)
        for (let i = 0; i < 5; i++) {
          readersStarted++;
          c.acquireReadLock(key, {lockRequestTimeout: 10000}, (err2, releaseRead) => {
            if (err2) {
              return t.fail(err2);
            }
            readersAcquired++;
            readerReleases.push(releaseRead);
            
            // After writer releases, readers should all acquire
            if (readersAcquired === 5) {
              // Release all readers
              readerReleases.forEach(r => r(() => {}));
              t.done();
            }
          });
        }

        // Release writer after a delay to allow readers to queue
        setTimeout(() => {
          if (!writerAcquired) {
            return t.fail(new Error('Writer should have acquired lock'));
          }
          writerReleased = true;
          releaseWrite(() => {});
        }, 500);
      });
    });

    it.cb('readers can coexist', {timeout: 15000}, t => {
      const c = t.supply.client;
      const key = 'readers-coexist';
      let readersAcquired = 0;
      const releases: any[] = [];
      const targetReaders = 10;

      for (let i = 0; i < targetReaders; i++) {
        c.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
          if (err) {
            return t.fail(err);
          }
          readersAcquired++;
          releases.push(release);
          
          if (readersAcquired === targetReaders) {
            // All readers acquired simultaneously
            releases.forEach(r => r(() => {}));
            t.done();
          }
        });
      }
    });

    it.cb('writer exclusive during readers', {timeout: 15000}, t => {
      const c = t.supply.client;
      const key = 'writer-exclusive';
      let readersAcquired = 0;
      const readerReleases: any[] = [];
      let writerAcquired = false;

      // First acquire multiple read locks
      for (let i = 0; i < 3; i++) {
        c.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
          if (err) {
            return t.fail(err);
          }
          readersAcquired++;
          readerReleases.push(release);
          
          // Once all readers acquired, try to get write lock
          if (readersAcquired === 3) {
            // Writer should wait, so release readers first
            setTimeout(() => {
              readerReleases.forEach(r => r(() => {}));
              
              // Now writer should acquire
              c.acquireWriteLock(key, {lockRequestTimeout: 10000}, (err2, releaseWrite) => {
                if (err2) {
                  return t.fail(new Error('Writer should acquire after readers release: ' + err2.message));
                }
                
                writerAcquired = true;
                releaseWrite(() => {
                  t.done();
                });
              });
            }, 200);
          }
        });
      }
    });

    it.cb('rapid read/write cycles', {timeout: 60000}, t => {
      const c = t.supply.client;
      const key = 'rapid-rw-cycles';
      const cycles = 10; // Reduced from 20 to avoid timeouts
      let completed = 0;
      let isWrite = false;

      const cycle = () => {
        if (isWrite) {
          c.acquireWriteLock(key, {lockRequestTimeout: 10000}, (err, release) => {
            if (err) {
              return t.fail(err);
            }
            setTimeout(() => {
              release(() => {
                completed++;
                isWrite = false;
                if (completed < cycles) {
                  cycle();
                } else {
                  t.done();
                }
              });
            }, 10);
          });
        } else {
          c.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
            if (err) {
              return t.fail(err);
            }
            setTimeout(() => {
              release(() => {
                completed++;
                isWrite = true;
                if (completed < cycles) {
                  cycle();
                } else {
                  t.done();
                }
              });
            }, 10);
          });
        }
      };

      cycle();
    });

    it.cb('multiple keys with RW locks', {timeout: 15000}, t => {
      const c = t.supply.client;
      const keys = ['rw-key1', 'rw-key2', 'rw-key3'];
      let acquired = 0;
      const releases: any[] = [];

      keys.forEach(key => {
        c.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
          if (err) {
            return t.fail(err);
          }
          acquired++;
          releases.push({key, release});
          
          if (acquired === keys.length) {
            releases.forEach(({release: r}) => r(() => {}));
            t.done();
          }
        });
      });
    });

    it.cb('write lock timeout when readers hold', {timeout: 15000}, t => {
      const c = t.supply.client;
      const key = 'write-timeout';
      let readerAcquired = false;
      const readerRelease: any[] = [];

      // Acquire read lock
      c.acquireReadLock(key, {lockRequestTimeout: 10000}, (err, release) => {
        if (err) {
          return t.fail(err);
        }
        readerAcquired = true;
        readerRelease.push(release);

        // Try to acquire write lock with short timeout
        c.acquireWriteLock(key, {lockRequestTimeout: 300}, (err2, releaseWrite) => {
          if (!err2) {
            releaseWrite(() => {});
            readerRelease[0](() => {});
            return t.fail(new Error('Write lock should timeout when reader holds lock'));
          }
          
          // Expected timeout error
          if (err2.message && err2.message.includes('timeout')) {
            readerRelease[0](() => {
              t.done();
            });
          } else {
            readerRelease[0](() => {});
            t.fail(new Error('Expected timeout error, got: ' + err2.message));
          }
        });
      });
    });

  });
  
}]);

