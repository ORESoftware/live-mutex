'use strict';

import * as assert from 'assert';

import {
  Client,
  ClientOpts,
  EndReadCallback,
  LMClientCallBack,
}
from "./client";

import {LMXLockRequestError} from "./main";
import chalk from "chalk";
import {weAreDebugging} from "./we-are-debugging";
import {forDebugging} from './shared-internal';
const debugLog = process.argv.indexOf('--lmx-debug') > 0;

export const log = {
  info: console.log.bind(console, chalk.gray.bold('[lmx client info]')),
  warn: console.error.bind(console, chalk.magenta.bold('[lmx client warning]')),
  error: console.error.bind(console, chalk.red.bold('[lmx client error]')),
  debug: function (...args: any[]) {
    if (debugLog) {
      let newTime = Date.now();
      let elapsed = newTime - forDebugging.previousTime;
      forDebugging.previousTime = newTime;
      console.log(chalk.yellow.bold('[lmx debugging]'), 'elapsed millis:', `(${elapsed})`, ...args);
    }
  }
};

import {RWStatus, EVCb} from "./shared-internal";
import {LMXClientLockException} from "./exceptions";


export class RWLockClient extends Client {
  
  readerCounts = <{ [key: string]: number }>{};
  writeKeys = <{ [key: string]: true }>{}; // keeps track of whether a key has been registered as a write key

  constructor(o?: Partial<ClientOpts>, cb?: LMClientCallBack) {
    super(o, cb);
    // RWClient implementation - read-preferring RW lock
    // Note: This is a basic implementation and may need further refinement
  }

  beginReadp(key: string, opts: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.beginRead(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  endReadp(key: string, opts: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.endRead(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  beginWritep(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.beginWrite(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  endWritep(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.endWrite(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  acquireWriteLock(key: string, opts: any, cb?: any) {
    return this.beginWrite.apply(this, arguments);
  }

  acquireReadLock(key: string, opts: any, cb?: any) {
    return this.beginRead.apply(this, arguments);
  }

  releaseWriteLock(key: string, opts: any, cb?: any) {
    return this.endWrite.apply(this, arguments);
  }

  releaseReadLock(key: string, opts: any, cb?: any) {
    return this.endRead.apply(this, arguments);
  }

  acquireWriteLockp(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.beginWrite(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  acquireReadLockp(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.beginRead(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  releaseWriteLockp(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.endWrite(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  releaseReadLockp(key: string, opts?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.endRead(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  beginWrite(key: string, opts: any, cb?: EVCb<any>) {

    try {
      [key, opts, cb] = this.parseLockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    // we prioritize write locks, over read locks, by using force = true
    opts.max = 1;
    opts.force = true;
    opts.rwStatus = RWStatus.BeginWrite;

    this.lock(key, opts, (err, val) => {

      if (err) {
        return cb(err, {});
      }

      const boundEndWrite = this.endWrite.bind(this, key);
      boundEndWrite.release = boundEndWrite.endWrite = boundEndWrite.unlock = boundEndWrite;
      boundEndWrite.key = key;
      cb(null, boundEndWrite);

    });
  }

  endWrite(key: string, opts: any, cb?: EVCb<any>) {

    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    // force unlock
    opts.rwStatus = RWStatus.EndWrite;
    opts.force = true;
    this.unlock(key, opts, cb);
  }

  beginRead(key: string, opts: any, cb: EVCb<any>) {

    try {
      [key, opts, cb] = this.parseLockOpts(key, opts, cb);
    }
    catch (err) {
      assert.strict(typeof cb === 'function', 'Must include a callback to the beginRead method.');
      return process.nextTick(cb, err);
    }

    opts.rwStatus = RWStatus.BeginRead;
    opts.max = 1;
    opts.force = false; // we want writers to have some chance to swoop in
    const writeKey = opts.writeKey;

    try {
      assert.strict(writeKey && typeof writeKey === 'string', '"writeKey" must be a string.');
      assert.strict(key !== writeKey, 'writeKey and readKey cannot be the same string.');
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    this.lock(key, opts, (err, unlock) => {

      if (err) {
        return cb(err, {});
      }

      const readers = unlock.readersCount;

      if (!Number.isInteger(readers)) {
        return this.fireLockCallbackWithError(cb, false, new LMXClientLockException(
          key,
          unlock.id,
          LMXLockRequestError.InternalError,
          'Implementation error, missing "readersCount".'
        ));
      }

      const boundEndRead: any = this.endRead.bind(this, key, {writeKey});
      boundEndRead.endRead = boundEndRead.unlock = boundEndRead.release = boundEndRead;
      boundEndRead._unlock = unlock; // Store unlock function for endRead
      boundEndRead._writeKey = writeKey; // Store writeKey for endRead

      // If we're the first reader (readers === 1), we need to lock the writeKey
      // to prevent writers from starting while we're reading
      if (readers === 1) {

        log.debug(chalk.magenta('readers is exactly 1, locking writeKey to prevent writers.'));

        // Lock the writeKey with force to ensure we get it even if a writer is waiting
        this.lock(writeKey, <any>{rwStatus: RWStatus.LockingWriteKey, force: true}, err => {

          if (err) {
            // If we can't lock the writeKey, unlock the read lock and return error
            return unlock((unlockErr) => {
              cb(err, {});
            });
          }

          // Mark that we locked the writeKey
          boundEndRead._lockedWriteKey = true;

          // We have both locks now, unlock the read lock and return
          unlock(err => {

            if (err) {
              // If unlock fails, try to unlock writeKey too
              this.unlock(writeKey, {force: true}, () => {});
              return cb(err, {});
            }

            cb(null, boundEndRead);
          });

        });
        return;
      }

      // Not the first reader, just unlock and return
      boundEndRead._lockedWriteKey = false;
      unlock(err => {

        if (err) {
          return cb(err, {});
        }

        cb(null, boundEndRead);
      });

    });

  }

  endRead(key: string, opts: any, cb: EndReadCallback) {

    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    const writeKey = opts.writeKey;

    try {
      assert.strict(writeKey && typeof writeKey === 'string', '"writeKey" must be a string.');
      assert.strict(key !== writeKey, 'writeKey and readKey cannot be the same string.');
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    // Check if opts is actually the bound release function from beginRead
    const boundEndRead = (opts && typeof opts === 'object' && opts._unlock) ? opts : null;
    
    if (boundEndRead && boundEndRead._unlock) {
      // We have the unlock function from beginRead
      opts.rwStatus = RWStatus.EndRead;
      opts.max = 1;
      
      // Lock to decrement reader count
      this.lock(key, opts, (err, v) => {
        if (err) {
          return cb(err);
        }

        const readers = v.readersCount;

        if (!Number.isInteger(readers)) {
          return cb('Implementation error, missing "readersCount".');
        }

        // Unlock the read lock (this decrements the reader count)
        v.unlock((unlockErr) => {
          if (unlockErr) {
            return cb(unlockErr);
          }

          // If we locked the writeKey (we were the first reader) and we're now the last reader,
          // unlock the writeKey
          if (boundEndRead._lockedWriteKey && readers === 1) {
            const writeKeyToUnlock = boundEndRead._writeKey || writeKey;
            this.unlock(writeKeyToUnlock, {force: true, rwStatus: RWStatus.UnlockingWriteKey}, (writeUnlockErr) => {
              if (writeUnlockErr) {
                return cb(writeUnlockErr);
              }
              cb(null);
            });
          } else {
            cb(null);
          }
        });
      });
      return;
    }

    // Fallback: acquire lock first, then release
    opts.rwStatus = RWStatus.EndRead;
    opts.max = 1;

    this.lock(key, opts, (err, v) => {

      if (err) {
        return cb(err);
      }

      const readers = v.readersCount;

      if (!Number.isInteger(readers)) {
        return cb('Implementation error, missing "readersCount".');
      }

      // Unlock the read lock
      v.unlock((unlockErr) => {
        if (unlockErr) {
          return cb(unlockErr);
        }

        // If we were the last reader, unlock the writeKey
        if (readers === 1) {
          this.unlock(writeKey, {force: true, rwStatus: RWStatus.UnlockingWriteKey}, (writeUnlockErr) => {
            if (writeUnlockErr) {
              return cb(writeUnlockErr);
            }
            cb(null);
          });
        } else {
          cb(null);
        }
      });

    });

  }

}

export const RWLockReadPrefClient = RWLockClient;