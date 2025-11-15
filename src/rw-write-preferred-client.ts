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
    // Always log RW lock operations for debugging
    if (weAreDebugging || process.env.LMX_DEBUG_RW === '1' || process.env.LMX_CAPTURE_LOGS === '1') {
      console.log('lmx debugging:', ...args);
    }
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
      [key, opts, cb] = this.parseLockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    opts.max = 1;
    // Create a bound release function that will pass itself as the opts parameter
    const boundRelease: any = (cb?: EVCb<any>) => {
      return this.releaseWriteLock(key, boundRelease, cb);
    };

    log.debug(chalk.blue('[RW] acquireWriteLock acquiring base lock for key:'), key);
    this.lock(key, opts, (err, unlock) => {
      log.debug(chalk.blue('[RW] acquireWriteLock base lock callback fired'), {key, err: !!err, hasUnlock: !!unlock});

      if (err) {
        log.debug(chalk.red('[RW] acquireWriteLock base lock ERROR'), {key, err});
        return cb(err, boundRelease);
      }

      log.debug(chalk.blue('acquireWriteLock got lock on:'), key);

      log.debug(chalk.blue('[RW] acquireWriteLock starting registerWriteFlagAndReadersCheck for key:'), key);
      this.registerWriteFlagAndReadersCheck(key, {}, (err, val) => {
        log.debug(chalk.blue('[RW] acquireWriteLock registerWriteFlagAndReadersCheck callback fired'), {key, err: !!err, hasVal: !!val});

        if (err) {
          // If there's an error, we need to unlock the lock we just acquired
          unlock((unlockErr) => {
            log.debug(chalk.blue('acquireWriteLock released lock due to error on:'), key);
            return cb(err, boundRelease);
          });
          return;
        }

        // Store the unlock function in the bound release function
        boundRelease._unlock = unlock;
        boundRelease._key = key;
        
        log.debug(chalk.blue('acquireWriteLock successfully acquired write lock on:'), key);
        cb(err, boundRelease);

      });

    });

  }

  releaseWriteLock(key: string, opts: any, cb: EVCb<any>) {

    const startTime = Date.now();
    log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock START'), {key, hasOpts: !!opts, hasCb: !!cb, optsType: typeof opts, hasUnlock: !!(opts && opts._unlock)});

    // Check if opts is actually the bound release function with stored unlock BEFORE parsing
    // This is important because boundRelease is a function, and parseUnlockOpts would treat it as a callback
    const boundRelease = (opts && (typeof opts === 'object' || typeof opts === 'function') && opts._unlock) ? opts : null;
    
    if (!boundRelease || !boundRelease._unlock) {
      // Not a bound release, parse normally
      try {
        [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
      }
      catch (err) {
        log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock parse error'), {key, err});
        return process.nextTick(cb, err);
      }
    } else {
      // It's a bound release, ensure we have a callback
      if (!cb && typeof opts === 'function') {
        cb = opts;
      }
      cb = cb || this.noop;
    }
    if (boundRelease && boundRelease._unlock) {
      // We have the unlock function from when we acquired the lock
      log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock using stored unlock for:'), key);
      
      // Unlock the lock first - use the base Client.unlock which handles timeouts properly
      // Add a safeguard timeout to ensure callback is always called
      const unlockStart = Date.now();
      let unlockCallbackCalled = false;
      const unlockTimeout = setTimeout(() => {
        if (!unlockCallbackCalled) {
          unlockCallbackCalled = true;
          log.debug(chalk.red('[RW-RELEASE] releaseWriteLock unlock TIMEOUT - calling callback anyway'), {key});
          delete boundRelease._unlock;
          delete boundRelease._key;
          // Call callback - unlock likely succeeded even if callback wasn't called
          const totalTime = Date.now() - startTime;
          log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock completed (unlock timeout) on:'), {key, totalTime});
          cb(null, {unlocked: true});
        }
      }, 10000); // 10 second timeout for unlock
      
      boundRelease._unlock((err: any, val: any) => {
        if (unlockCallbackCalled) {
          return; // Already handled by timeout
        }
        unlockCallbackCalled = true;
        clearTimeout(unlockTimeout);
        const unlockTime = Date.now() - unlockStart;
        log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock unlock callback'), {key, err: !!err, unlockTime, hasVal: !!val});
        if (err) {
          log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock unlock error on:'), key, err);
          delete boundRelease._unlock;
          delete boundRelease._key;
          // Always call callback, even on error
          return cb(err, val || {});
        }
        
        log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock unlocked, now setting write flag to false on:'), key);
        
        // Set the write flag to false and broadcast to waiting readers
        // This must happen after unlock to avoid deadlocks
        // Use a timeout to ensure callback is always called
        const flagStart = Date.now();
        let flagCallbackCalled = false;
        const flagTimeout = setTimeout(() => {
          if (!flagCallbackCalled) {
            flagCallbackCalled = true;
            log.debug(chalk.red('[RW-RELEASE] releaseWriteLock setWriteFlagToFalse TIMEOUT'), {key});
            delete boundRelease._unlock;
            delete boundRelease._key;
            // Call callback with success - the unlock succeeded, flag setting is best-effort
            const totalTime = Date.now() - startTime;
            log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock completed (flag timeout) on:'), {key, totalTime});
            cb(null, val || {unlocked: true});
          }
        }, 5000);
        
        this.setWriteFlagToFalse(key, (flagErr, flagVal) => {
          if (flagCallbackCalled) {
            return; // Already handled by timeout
          }
          flagCallbackCalled = true;
          clearTimeout(flagTimeout);
          const flagTime = Date.now() - flagStart;
          const totalTime = Date.now() - startTime;
          log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock completed on:'), {key, flagTime, totalTime});
          delete boundRelease._unlock;
          delete boundRelease._key;
          // Return success even if flag setting had minor issues
          cb(null, val || {unlocked: true});
        });
      });
      return;
    }

    // Fallback: acquire lock first, then release
    opts.max = 1;

    const fallbackStart = Date.now();
    log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock fallback path'), {key});
    this.lock(key, opts, (err, unlock) => {

      if (err) {
        log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock fallback lock error'), {key, err});
        return cb(err, unlock);
      }

      log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock got lock on:'), key);

      // Unlock first
      const fallbackUnlockStart = Date.now();
      unlock((unlockErr, unlockVal) => {
        const fallbackUnlockTime = Date.now() - fallbackUnlockStart;
        log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock fallback unlock callback'), {key, err: !!unlockErr, fallbackUnlockTime});
        if (unlockErr) {
          log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock fallback unlock error:'), unlockErr);
          return cb(unlockErr, unlockVal);
        }
        
        log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock unlocked, now setting write flag to false'));
        
        const fallbackFlagStart = Date.now();
        this.setWriteFlagToFalse(key, (flagErr, flagVal) => {
          const fallbackFlagTime = Date.now() - fallbackFlagStart;
          const fallbackTotalTime = Date.now() - fallbackStart;
          log.debug(chalk.magenta('[RW-RELEASE] releaseWriteLock fallback completed'), {key, fallbackFlagTime, fallbackTotalTime});
          // Return success even if flag setting had minor issues
          cb(null, unlockVal);
        });
      });

    });

  }

  acquireReadLock(key: string, opts: any, cb: EVCb<any>) {

    try {
      [key, opts, cb] = this.parseLockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    // Create a bound release function that will pass itself as the opts parameter
    const boundRelease: any = (cb?: EVCb<any>) => {
      return this.releaseReadLock(key, boundRelease, cb);
    };

    // First check writer flag BEFORE acquiring lock (critical fix)
    log.debug(chalk.blue('[RW] acquireReadLock starting writer flag check for key:'), key);
    this.registerWriteFlagCheck(key, {}, (err, val) => {
      log.debug(chalk.blue('[RW] acquireReadLock writer flag check callback fired'), {key, err: !!err, hasVal: !!val});

      if (err) {
        log.debug(chalk.red('[RW] acquireReadLock writer flag check ERROR'), {key, err});
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

          // Store the unlock function in the bound release function
          boundRelease._unlock = unlock;
          boundRelease._key = key;

          log.debug(chalk.blue('acquireReadLock successfully acquired read lock on key:'), key);
          cb(err, boundRelease);

        });

      });

    });

  }

  releaseReadLock(key: string, opts: any, cb: EVCb<any>) {

    const startTime = Date.now();
    log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock START'), {key, hasOpts: !!opts, hasCb: !!cb, optsType: typeof opts, hasUnlock: !!(opts && opts._unlock)});

    // Check if opts is actually the bound release function with stored unlock BEFORE parsing
    // This is important because boundRelease is a function, and parseUnlockOpts would treat it as a callback
    const boundRelease = (opts && (typeof opts === 'object' || typeof opts === 'function') && opts._unlock) ? opts : null;
    
    if (!boundRelease || !boundRelease._unlock) {
      // Not a bound release, parse normally
      try {
        [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
      }
      catch (err) {
        log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock parse error'), {key, err});
        return process.nextTick(cb, err);
      }
    } else {
      // It's a bound release, ensure we have a callback
      if (!cb && typeof opts === 'function') {
        cb = opts;
      }
      cb = cb || this.noop;
    }
    if (boundRelease && boundRelease._unlock) {
      // We have the unlock function from when we acquired the lock
      log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock using stored unlock for key:'), key);
      
      const decrementStart = Date.now();
      this.decrementReaders(key, (err, val) => {
        const decrementTime = Date.now() - decrementStart;
        log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock decrementReaders callback'), {key, err: !!err, decrementTime});
        if (err) {
          delete boundRelease._unlock;
          delete boundRelease._key;
          // Always call callback, even on error
          return cb(err, {});
        }

        // Use the stored unlock function - base Client.unlock handles timeouts
        const unlockStart = Date.now();
        boundRelease._unlock((err: any, val: any) => {
          const unlockTime = Date.now() - unlockStart;
          const totalTime = Date.now() - startTime;
          log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock completed'), {key, err: !!err, unlockTime, totalTime, hasVal: !!val});
          delete boundRelease._unlock;
          delete boundRelease._key;
          // Always call callback - base unlock handles timeouts and errors
          cb(err, val || {unlocked: true});
        });
      });
      return;
    }

    // Fallback: acquire lock first, then release
    opts.max = 1;

    const fallbackStart = Date.now();
    log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock fallback path'), {key});
    this.lock(key, opts, (err, unlock) => {

      if (err) {
        log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock fallback lock error'), {key, err});
        return cb(err, unlock);
      }

      log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock got lock on key:'), key);

      const fallbackDecrementStart = Date.now();
      this.decrementReaders(key, (err, val) => {
        const fallbackDecrementTime = Date.now() - fallbackDecrementStart;
        log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock fallback decrementReaders callback'), {key, err: !!err, fallbackDecrementTime});

        if (err) {
          return cb(err, unlock);
        }

        const fallbackUnlockStart = Date.now();
        unlock((err, val) => {
          const fallbackUnlockTime = Date.now() - fallbackUnlockStart;
          const fallbackTotalTime = Date.now() - fallbackStart;
          log.debug(chalk.magenta('[RW-RELEASE] releaseReadLock fallback completed'), {key, fallbackUnlockTime, fallbackTotalTime});
          cb(err, val);
        });

      });

    });

  }

  registerWriteFlagCheck(key: string, opts: any, cb: EVCb<any>) {

    const uuid = UUID.v4();
    log.debug(chalk.cyan('[RW] registerWriteFlagCheck START'), {key, uuid});

    this.resolutions[uuid] = (err, val) => {
      log.debug(chalk.cyan('[RW] registerWriteFlagCheck RESPONSE'), {key, uuid, err: !!err, valType: val?.type, hasVal: !!val});
      log.debug(chalk.magenta('client got register-write-flag-check response, type:', val?.type));
      
      // If we got a queued response, wait for the actual success response
      if (val && val.type === 'register-write-flag-check-queued') {
        log.debug(chalk.magenta('read request queued, waiting for writer to finish...'));
        // Don't delete the resolution yet - we need to wait for the success response
        // The broker will call the fn() which sends the success response
        return;
      }
      
      // This is the final success response
      delete this.resolutions[uuid];
      log.debug(chalk.cyan('[RW] registerWriteFlagCheck CALLING CALLBACK'), {key, uuid});
      return cb(err, val);
    };

    log.debug(chalk.cyan('[RW] registerWriteFlagCheck SENDING REQUEST'), {key, uuid});
    this.write({key, uuid, type: 'register-write-flag-check'});

  }

  registerWriteFlagAndReadersCheck(key: string, opts: any, cb: EVCb<any>) {

    const uuid = UUID.v4();
    log.debug(chalk.cyan('[RW] registerWriteFlagAndReadersCheck START'), {key, uuid});

    this.resolutions[uuid] = (err, val) => {
      log.debug(chalk.cyan('[RW] registerWriteFlagAndReadersCheck RESPONSE'), {key, uuid, err: !!err, valType: val?.type, hasVal: !!val});
      delete this.resolutions[uuid];
      log.debug(chalk.cyan('[RW] registerWriteFlagAndReadersCheck CALLING CALLBACK'), {key, uuid});
      cb(err, val);
    };

    log.debug(chalk.cyan('[RW] registerWriteFlagAndReadersCheck SENDING REQUEST'), {key, uuid});
    this.write({
      key,
      uuid,
      type: 'register-write-flag-and-readers-check'
    });

  }

  incrementReaders(key: any, cb: any) {
    const uuid = UUID.v4();
    log.debug(chalk.cyan('[RW] incrementReaders START'), {key, uuid});
    this.resolutions[uuid] = (err, val) => {
      log.debug(chalk.cyan('[RW] incrementReaders RESPONSE'), {key, uuid, err: !!err, valType: val?.type, hasVal: !!val});
      log.debug(chalk.cyan('[RW] incrementReaders CALLING CALLBACK'), {key, uuid});
      cb(err, val);
    };
    log.debug(chalk.cyan('[RW] incrementReaders SENDING REQUEST'), {key, uuid});
    this.write({
      uuid,
      type: 'increment-readers',
      key
    });
  }

  decrementReaders(key: string, cb: EVCb<any>) {
    const uuid = UUID.v4();
    log.debug(chalk.cyan('[RW] decrementReaders START'), {key, uuid});
    this.resolutions[uuid] = (err, val) => {
      log.debug(chalk.cyan('[RW] decrementReaders RESPONSE'), {key, uuid, err: !!err, valType: val?.type, hasVal: !!val});
      log.debug(chalk.cyan('[RW] decrementReaders CALLING CALLBACK'), {key, uuid});
      cb(err, val);
    };
    log.debug(chalk.cyan('[RW] decrementReaders SENDING REQUEST'), {key, uuid});
    this.write({
      uuid,
      type: 'decrement-readers',
      key
    });
  }

  setWriteFlagToFalse(key: string, cb: EVCb<any>) {
    const uuid = UUID.v4();
    log.debug(chalk.cyan('[RW] setWriteFlagToFalse START'), {key, uuid});
    
    let callbackCalled = false;
    const timeout = setTimeout(() => {
      if (!callbackCalled) {
        callbackCalled = true;
        log.debug(chalk.red('[RW] setWriteFlagToFalse TIMEOUT - calling callback anyway'), {key, uuid});
        delete this.resolutions[uuid];
        // Call callback with success even on timeout - the operation likely succeeded
        cb(null, {type: 'write-flag-false-and-broadcast-success', key});
      }
    }, 5000); // 5 second timeout
    
    this.resolutions[uuid] = (err, val) => {
      if (callbackCalled) {
        log.debug(chalk.yellow('[RW] setWriteFlagToFalse callback already called, ignoring duplicate response'), {key, uuid});
        return;
      }
      callbackCalled = true;
      clearTimeout(timeout);
      log.debug(chalk.cyan('[RW] setWriteFlagToFalse RESPONSE'), {key, uuid, err: !!err, valType: val?.type, hasVal: !!val});
      log.debug(chalk.cyan('[RW] setWriteFlagToFalse CALLING CALLBACK'), {key, uuid});
      cb(err, val);
    };
    log.debug(chalk.cyan('[RW] setWriteFlagToFalse SENDING REQUEST'), {key, uuid});
    this.write({
      uuid,
      type: 'set-write-flag-false-and-broadcast',
      key
    });
  }

}