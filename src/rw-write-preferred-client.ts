'use strict';


import {routineEnter} from './routine';
//core
import * as assert from 'assert';

//npm
import chalk from "chalk";
import * as UUID from 'uuid';

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
    const routineId = 'ddl-routine-RFeluGBXPX8S3WF5-0';
    routineEnter(routineId, "RWLockWritePrefClient.constructor");
    super(o, cb);
  }

  beginReadp(key: string, opts: any): Promise<any> {
    const routineId = 'ddl-routine-fWkzJ08QVW1x2ImUXx';
    routineEnter(routineId, "RWLockWritePrefClient.beginReadp");
    return new Promise((resolve, reject) => {
      this.acquireReadLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  endReadp(key: string, opts: any): Promise<any> {
    const routineId = 'ddl-routine-AcyFMbU-iU6aF9cxLB';
    routineEnter(routineId, "RWLockWritePrefClient.endReadp");
    return new Promise((resolve, reject) => {
      this.releaseReadLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  beginWritep(key: string, opts?: any): Promise<any> {
    const routineId = 'ddl-routine-uvjj__lQvA4w39ygy1';
    routineEnter(routineId, "RWLockWritePrefClient.beginWritep");
    return new Promise((resolve, reject) => {
      this.acquireWriteLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  endWritep(key: string, opts?: any): Promise<any> {
    const routineId = 'ddl-routine-g8_xD82jp4ACm0xy5C';
    routineEnter(routineId, "RWLockWritePrefClient.endWritep");
    return new Promise((resolve, reject) => {
      this.releaseWriteLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  acquireWriteLockp(key: string, opts?: any): Promise<any> {
    const routineId = 'ddl-routine-UILmLOt1cuk-KCzUIj';
    routineEnter(routineId, "RWLockWritePrefClient.acquireWriteLockp");
    return new Promise((resolve, reject) => {
      this.acquireWriteLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  acquireReadLockp(key: string, opts?: any): Promise<any> {
    const routineId = 'ddl-routine-H3vDaxBhkwK97Hkdiu';
    routineEnter(routineId, "RWLockWritePrefClient.acquireReadLockp");
    return new Promise((resolve, reject) => {
      this.acquireReadLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  releaseWriteLockp(key: string, opts?: any): Promise<any> {
    const routineId = 'ddl-routine-SbWRlGUkrnvehbHZQL';
    routineEnter(routineId, "RWLockWritePrefClient.releaseWriteLockp");
    return new Promise((resolve, reject) => {
      this.releaseWriteLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  releaseReadLockp(key: string, opts?: any): Promise<any> {
    const routineId = 'ddl-routine-H0RKKE3Yjmt5yYEAj5';
    routineEnter(routineId, "RWLockWritePrefClient.releaseReadLockp");
    return new Promise((resolve, reject) => {
      this.releaseReadLock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  acquireWriteLock(key: string, opts: any, cb?: EVCb<any>) {
    const routineId = 'ddl-routine-iXDKPxq-_wZJp9q9ls';
    routineEnter(routineId, "RWLockWritePrefClient.acquireWriteLock");

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
    // Set maxWrite to explicitly separate write lock limits from read lock limits
    opts.maxWrite = opts.maxWrite !== undefined ? opts.maxWrite : opts.max;
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
    const routineId = 'ddl-routine-apug8gaDGGQEYSdpxD';
    routineEnter(routineId, "RWLockWritePrefClient.releaseWriteLock");

    // Check if opts is actually the bound release function with stored unlock BEFORE parseUnlockOpts
    // because parseUnlockOpts will treat a function as a callback and move it to cb
    log.debug(chalk.blue('releaseWriteLock: BEFORE parseUnlockOpts - key:'), key, 'opts type:', typeof opts, 'has _unlock:', opts && (opts as any)._unlock ? 'yes' : 'no', 'cb type:', typeof cb);
    const boundRelease = (opts && (typeof opts === 'object' || typeof opts === 'function') && (opts as any)._unlock) ? opts : null;
    
    // If we found boundRelease, we need to handle it specially
    if (boundRelease && (boundRelease as any)._unlock) {
      // We have the unlock function from when we acquired the lock
      log.debug(chalk.blue('releaseWriteLock using stored unlock for:'), key);
      
      const unlockFn = (boundRelease as any)._unlock;
      const realCb = cb || (() => {});
      
      // Unlock the lock first
      log.debug(chalk.blue('releaseWriteLock: calling _unlock for key:'), key);
      unlockFn((err: any, val: any) => {
        log.debug(chalk.blue('releaseWriteLock: _unlock callback called for key:'), key, 'err:', err, 'val unlocked:', val?.unlocked);
        if (err) {
          log.debug(chalk.blue('releaseWriteLock unlock error on:'), key, err);
          delete (boundRelease as any)._unlock;
          delete (boundRelease as any)._key;
          return realCb(err, val);
        }
        
        log.debug(chalk.blue('releaseWriteLock unlocked, now setting write flag to false on:'), key);
        
        // Set the write flag to false and broadcast to waiting readers
        // This must happen after unlock to avoid deadlocks
        this.setWriteFlagToFalse(key, (flagErr, flagVal) => {
          log.debug(chalk.blue('releaseWriteLock: setWriteFlagToFalse callback called for key:'), key, 'flagErr:', flagErr, 'flagVal type:', flagVal?.type);
          log.debug(chalk.blue('releaseWriteLock completed on:'), key);
          delete (boundRelease as any)._unlock;
          delete (boundRelease as any)._key;
          // Return success even if flag setting had minor issues
          log.debug(chalk.blue('releaseWriteLock: calling final cb for key:'), key, 'cb type:', typeof realCb);
          realCb(null, val);
        });
      });
      return;
    }

    // Normal path: parse options
    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
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
    const routineId = 'ddl-routine-zfD8dlPlc2E_SuhDrG';
    routineEnter(routineId, "RWLockWritePrefClient.acquireReadLock");

    try {
      [key, opts, cb] = this.parseLockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    // Create a bound release function that will pass itself as the opts parameter
    const boundRelease: any = (cb?: EVCb<any>) => {
      log.debug(chalk.blue('boundRelease function called for key:'), key, 'cb type:', typeof cb, 'has _unlock:', boundRelease._unlock ? 'yes' : 'no');
      if (!boundRelease._unlock) {
        log.error(chalk.red('boundRelease called but _unlock is missing for key:'), key);
        if (typeof cb === 'function') {
          return process.nextTick(cb, new Error('_unlock function missing from boundRelease'), {});
        }
        return;
      }
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

      // For read locks, default to 10 concurrent readers (write locks default to 1)
      // Only set max if user hasn't explicitly set it
      // If user explicitly sets max (e.g., max=1 or max=5), honor that value
      // The actual reader count is tracked separately via incrementReaders
      if (opts.max === undefined || opts.max === null) {
        opts.max = 10; // Default: allow up to 10 concurrent readers
      }
      // Set maxRead to explicitly separate read lock limits from write lock limits
      opts.maxRead = opts.maxRead !== undefined ? opts.maxRead : opts.max;
      // User's explicit max value (including max=1) will be honored by the broker

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
    const routineId = 'ddl-routine-SSlo3cvRzbFg0ybHEO';
    routineEnter(routineId, "RWLockWritePrefClient.releaseReadLock");

    // Check if opts is actually the bound release function BEFORE parseUnlockOpts
    // because parseUnlockOpts will treat a function as a callback and move it to cb
    log.debug(chalk.blue('releaseReadLock: BEFORE parseUnlockOpts - key:'), key, 'opts type:', typeof opts, 'has _unlock:', opts && (opts as any)._unlock ? 'yes' : 'no', 'cb type:', typeof cb);
    const boundRelease = (opts && (typeof opts === 'object' || typeof opts === 'function') && (opts as any)._unlock) ? opts : null;
    
    // If we found boundRelease, we need to handle it specially
    // because parseUnlockOpts will treat it as a callback
    if (boundRelease && (boundRelease as any)._unlock) {
      // boundRelease is the function itself, and cb is the actual callback
      // We need to extract the real callback
      const realCb = (typeof cb === 'function') ? cb : (boundRelease as any);
      const unlockFn = (boundRelease as any)._unlock; // Store it before it might get deleted
      log.debug(chalk.blue('releaseReadLock: found boundRelease, using stored unlock for key:'), key, 'unlockFn type:', typeof unlockFn);
      
      if (!unlockFn || typeof unlockFn !== 'function') {
        log.error(chalk.red('releaseReadLock: _unlock is not a function for key:'), key, 'type:', typeof unlockFn);
        return realCb(new Error('_unlock is not a function'), {});
      }
      
      log.debug(chalk.blue('releaseReadLock: calling decrementReaders for key:'), key);
      this.decrementReaders(key, (err, val) => {
        log.debug(chalk.blue('releaseReadLock: decrementReaders callback called for key:'), key, 'err:', err, 'val type:', val?.type);
        if (err) {
          log.debug(chalk.blue('releaseReadLock: decrementReaders error, calling cb with error'));
          return realCb(err, {});
        }

        log.debug(chalk.blue('releaseReadLock: calling _unlock for key:'), key, '_unlock type:', typeof unlockFn);
        // Use the stored unlock function (we stored it earlier to avoid deletion issues)
        try {
          unlockFn((err: any, val: any) => {
            log.debug(chalk.blue('releaseReadLock: _unlock callback called for key:'), key, 'err:', err, 'val unlocked:', val?.unlocked);
            log.debug(chalk.blue('releaseReadLock released lock on key:'), key);
            // Only delete after successful unlock
            if ((boundRelease as any)._unlock) {
              delete (boundRelease as any)._unlock;
            }
            if ((boundRelease as any)._key) {
              delete (boundRelease as any)._key;
            }
            log.debug(chalk.blue('releaseReadLock: calling final cb for key:'), key, 'cb type:', typeof realCb);
            realCb(err, val);
          });
        } catch (e) {
          log.error(chalk.red('releaseReadLock: exception calling _unlock for key:'), key, e);
          return realCb(e as any, {});
        }
      });
      return;
    }
    
    // Normal path: parse options
    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
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
    const routineId = 'ddl-routine-14zQkFTXSx1IgbdDJn';
    routineEnter(routineId, "RWLockWritePrefClient.registerWriteFlagCheck");

    const uuid = UUID.v4();
    log.debug(chalk.cyan('[RW] registerWriteFlagCheck START'), {key, uuid});

    this.resolutions[uuid] = (err, val) => {
      log.debug(chalk.magenta('client got register-write-flag-check response, type:', val?.type, 'uuid:', uuid));
      
      // If we got a queued response, wait for the actual success response
      if (val && val.type === 'register-write-flag-check-queued') {
        log.debug(chalk.magenta('read request queued, waiting for writer to finish...'));
        // Don't delete the resolution yet - we need to wait for the success response
        // The broker will call the fn() which sends the success response
        return;
      }
      
      // Ignore broadcast-result messages - they're just notifications
      if (val && val.type === 'broadcast-result') {
        log.debug(chalk.magenta('ignoring broadcast-result, still waiting for register-write-flag-success'));
        return;
      }

      if (val && val.type !== 'register-write-flag-success') {
        log.debug(chalk.magenta('unexpected broadcast-result, still waiting for register-write-flag-success'), {val});
        return;
      }
      
      // This is the final success response (register-write-flag-success)
      log.debug(chalk.magenta('received final success response, calling callback'));
      delete this.resolutions[uuid];
      log.debug(chalk.cyan('[RW] registerWriteFlagCheck CALLING CALLBACK'), {key, uuid});
      return cb(err, val);
    };

    log.debug(chalk.cyan('[RW] registerWriteFlagCheck SENDING REQUEST'), {key, uuid});
    this.write({key, uuid, type: 'register-write-flag-check'});

  }

  registerWriteFlagAndReadersCheck(key: string, opts: any, cb: EVCb<any>) {
    const routineId = 'ddl-routine-8VLJlrbuqkiMJzb6db';
    routineEnter(routineId, "RWLockWritePrefClient.registerWriteFlagAndReadersCheck");

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
    const routineId = 'ddl-routine-El9VpZ6eV6Qv7brWwz';
    routineEnter(routineId, "RWLockWritePrefClient.incrementReaders");
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
    const routineId = 'ddl-routine-BVvculPm40pPPUY5Nk';
    routineEnter(routineId, "RWLockWritePrefClient.decrementReaders");
    const uuid = UUID.v4();
    log.debug(chalk.magenta('decrementReaders: sending request for key:'), key, 'uuid:', uuid);
    this.resolutions[uuid] = (err, val) => {
      log.debug(chalk.magenta('decrementReaders: received response for key:'), key, 'uuid:', uuid, 'type:', val?.type);
      cb(err, val);
    };
    this.write({
      uuid,
      type: 'decrement-readers',
      key
    });
  }

  setWriteFlagToFalse(key: string, cb: EVCb<any>) {
    const routineId = 'ddl-routine-TWDv0jf1RceECPoxnZ';
    routineEnter(routineId, "RWLockWritePrefClient.setWriteFlagToFalse");
    const uuid = UUID.v4();
    log.debug(chalk.magenta('setWriteFlagToFalse: sending request for key:'), key, 'uuid:', uuid);
    this.resolutions[uuid] = (err, val) => {
      log.debug(chalk.magenta('setWriteFlagToFalse: received response for key:'), key, 'uuid:', uuid, 'type:', val?.type, 'err:', err);
      cb(err, val);
    };
    this.write({
      uuid,
      type: 'set-write-flag-false-and-broadcast',
      key
    });
  }

  /**
   * Attach a callback to listen for warning events and output them
   * @param callback Function that receives warning messages/errors
   */
  onWarning(callback: (...args: any[]) => void): void {
    const routineId = 'ddl-routine-dUFeZhwK1uG1MbCZeD';
    routineEnter(routineId, "RWLockWritePrefClient.onWarning");
    this.emitter.on('warning', callback);
  }

  /**
   * Attach a callback to listen for error events and output them
   * @param callback Function that receives error messages
   */
  onError(callback: (...args: any[]) => void): void {
    const routineId = 'ddl-routine--ECm8EsRYgoIo17gie';
    routineEnter(routineId, "RWLockWritePrefClient.onError");
    this.emitter.on('error', callback);
  }

}