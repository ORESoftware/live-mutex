'use strict';

//core
import * as assert from 'assert';

//npm
import chalk from "chalk";
import UUID = require('uuid');

//project
import {Client, ClientOpts, LMClientCallBack, LMClientUnlockCallBack} from "./client";
import {weAreDebugging} from "./we-are-debugging";
import {EVCb} from "./shared-internal";


export const log = {
  info: console.log.bind(console, chalk.gray.bold('lmx client info:')),
  warn: console.error.bind(console, chalk.magenta.bold('lmx client warning:')),
  error: console.error.bind(console, chalk.red.bold('lmx client error:')),
  debug: function (...args: any[]) {
    weAreDebugging && console.log('lmx debugging:', ...args);
  }
};

export class RWLockWritePrefClient extends Client {
  
  readerCounts = <{ [key: string]: number }>{};
  writeKeys = <{ [key: string]: true }>{}; // keeps track of whether a key has been registered as a write key

  constructor(o?: Partial<ClientOpts>, cb?: LMClientCallBack) {
    super(o, cb);
  }

  beginReadp(key: string, opts: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.acquireReadLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  endReadp(key: string, opts: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.releaseReadLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  beginWritep(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.acquireWriteLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  endWritep(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.releaseWriteLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  acquireWriteLockp(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.acquireWriteLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  acquireReadLockp(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.acquireReadLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  releaseWriteLockp(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.releaseWriteLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  releaseReadLockp(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.releaseReadLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  acquireWriteLock(key: string, opts: any, cb?: EVCb<any>) {

    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    opts.max = 1;
    
    // Create a release function that will clear writer flag and release lock
    // We'll store the unlock function on this object
    const boundRelease: any = (releaseCb?: EVCb<any>) => {
      // Use stored unlock if available
      if (boundRelease._unlock) {
        log.debug(chalk.blue('releaseWriteLock using stored unlock'));
        this.setWriteFlagToFalse(key, (err: any, val: any) => {
          if (err) {
            return releaseCb && releaseCb(err);
          }
          boundRelease._unlock((unlockErr: any, unlockVal: any) => {
            log.debug(chalk.blue('releaseWriteLock released lock'));
            releaseCb && releaseCb(unlockErr, unlockVal);
          });
        });
      } else {
        // Fallback to normal release
        this.releaseWriteLock(key, {}, releaseCb);
      }
    };

    this.lock(key, opts, (err, unlock) => {

      if (err) {
        return cb(err, boundRelease);
      }

      log.debug(chalk.blue('acquireWriteLock got lock on:'), key);

      // Set writer flag while holding the lock
      this.registerWriteFlagAndReadersCheck(key, {}, (err, val) => {

        if (err) {
          // If setting writer flag fails, release the lock
          unlock(() => {});
          return cb(err, boundRelease);
        }

        log.debug(chalk.blue('acquireWriteLock writer flag set, holding lock'));
        
        // DON'T release the lock here - hold it while writer is active
        // Store the unlock function on the boundRelease so it can be used later
        boundRelease._unlock = unlock;
        cb(err, boundRelease);

      });

    });

  }

  releaseWriteLock(key: string, opts: any, cb: EVCb<any>) {

    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    // Check if we have a stored unlock function from acquireWriteLock
    // The cb parameter might be the boundRelease function with _unlock stored
    const storedUnlock = (cb as any)._unlock;
    
    if (storedUnlock) {
      // We already have the lock, just need to clear writer flag and release
      log.debug(chalk.blue('releaseWriteLock clearing writer flag and releasing lock'));
      
      this.setWriteFlagToFalse(key, (err: any, val: any) => {
        if (err) {
          return cb(err);
        }
        
        storedUnlock((unlockErr: any, unlockVal: any) => {
          log.debug(chalk.blue('releaseWriteLock released lock on key:'), key);
          cb(unlockErr, unlockVal);
        });
      });
    } else {
      // Fallback: acquire lock first (shouldn't normally happen)
      opts.max = 1;
      
      this.lock(key, opts, (err, unlock) => {
        if (err) {
          return cb(err, unlock);
        }

        log.debug(chalk.blue('releaseWriteLock got lock on:'), key);

        this.setWriteFlagToFalse(key, (err, val) => {
          if (err) {
            return cb(err, unlock);
          }

          unlock((err, val) => {
            log.debug(chalk.blue('releaseWriteLock released lock on key:'), key);
            cb(err, val);
          });
        });
      });
    }

  }

  acquireReadLock(key: string, opts: any, cb: EVCb<any>) {

    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    // Create a release function that will decrement readers and release lock
    const boundRelease: any = (releaseCb?: EVCb<any>) => {
      // Use stored unlock if available
      if (boundRelease._unlock) {
        log.debug(chalk.blue('releaseReadLock using stored unlock'));
        this.decrementReaders(key, (err: any, val: any) => {
          if (err) {
            return releaseCb && releaseCb(err);
          }
          boundRelease._unlock((unlockErr: any, unlockVal: any) => {
            log.debug(chalk.blue('releaseReadLock released lock'));
            releaseCb && releaseCb(unlockErr, unlockVal);
          });
        });
      } else {
        // Fallback to normal release
        this.releaseReadLock(key, {}, releaseCb);
      }
    };

    // First check writer flag BEFORE acquiring lock
    this.registerWriteFlagCheck(key, {}, (err, val) => {

      if (err) {
        return cb(err, boundRelease);
      }

      log.debug(chalk.blue('acquireReadLock writer flag check passed, acquiring lock'));

      // Now acquire the lock
      opts.max = 1;

      this.lock(key, opts, (err, unlock) => {

        if (err) {
          return cb(err, boundRelease);
        }

        log.debug(chalk.blue('acquireReadLock got lock on key:'), key);

        // Increment readers count
        this.incrementReaders(key, (err: any, val: any) => {
          if (err) {
            unlock(() => {});
            return cb(err, boundRelease);
          }

          log.debug(chalk.magenta('acquireReadLock reader count incremented'));

          // Store unlock function for release
          boundRelease._unlock = unlock;
          cb(err, boundRelease);
        });

      });

    });

  }

  releaseReadLock(key: string, opts: any, cb: EVCb<any>) {

    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    // Check if we have a stored unlock function from acquireReadLock
    // The cb parameter might be the boundRelease function with _unlock stored
    const storedUnlock = (cb as any)._unlock;
    
    if (storedUnlock) {
      // We already have the lock, just decrement readers and release
      log.debug(chalk.blue('releaseReadLock decrementing readers and releasing lock'));
      
      this.decrementReaders(key, (err: any, val: any) => {
        if (err) {
          return cb(err);
        }

        storedUnlock((unlockErr: any, unlockVal: any) => {
          log.debug(chalk.blue('releaseReadLock released lock on key:'), key);
          cb(unlockErr, unlockVal);
        });
      });
    } else {
      // Fallback: acquire lock first (shouldn't normally happen)
      opts.max = 1;

      this.lock(key, opts, (err, unlock) => {
        if (err) {
          return cb(err, unlock);
        }

        log.debug(chalk.blue('releaseReadLock got lock on key:'), key);

        this.decrementReaders(key, (err, val) => {
          if (err) {
            return cb(err, unlock);
          }

          unlock((err, val) => {
            log.debug(chalk.blue('releaseReadLock released lock on key:'), key);
            cb(err, val);
          });
        });
      });
    }

  }

  registerWriteFlagCheck(key: string, opts: any, cb: EVCb<any>) {

    const uuid = UUID.v4();

    this.resolutions[uuid] = (err, val) => {
      delete this.resolutions[uuid];
      log.debug(chalk.magenta('client got register-write-flag-check'));
      return cb(err, val);
    };

    this.write({key, uuid, type: 'register-write-flag-check'});

  }

  registerWriteFlagAndReadersCheck(key: string, opts: any, cb: EVCb<any>) {

    const uuid = UUID.v4();

    this.resolutions[uuid] = (err, val) => {
      delete this.resolutions[uuid];
      cb(err, val);
    };

    this.write({
      key,
      uuid,
      type: 'register-write-flag-and-readers-check'
    });

  }

  incrementReaders(key: any, cb: any) {
    const uuid = UUID.v4();
    this.resolutions[uuid] = cb;
    this.write({
      uuid,
      type: 'increment-readers',
      key
    });
  }

  decrementReaders(key: string, cb: EVCb<any>) {
    const uuid = UUID.v4();
    this.resolutions[uuid] = cb;
    this.write({
      uuid,
      type: 'decrement-readers',
      key
    });
  }

  setWriteFlagToFalse(key: string, cb: EVCb<any>) {
    const uuid = UUID.v4();
    this.resolutions[uuid] = cb;
    this.write({
      uuid,
      type: 'set-write-flag-false-and-broadcast',
      key
    });
  }

}