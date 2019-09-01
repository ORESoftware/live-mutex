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
    throw 'RWClient not yet fully implemented, TBD';
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
      assert(typeof cb === 'function', 'Must include a callback to the beginRead method.');
      return process.nextTick(cb, err);
    }

    opts.rwStatus = RWStatus.BeginRead;
    opts.max = 1;
    opts.force = false; // we want writers to have some chance to swoop in
    const writeKey = opts.writeKey;

    try {
      assert(writeKey && typeof writeKey === 'string', '"writeKey" must be a string.');
      assert(key !== writeKey, 'writeKey and readKey cannot be the same string.');
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
        return this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          unlock.id,
          LMXLockRequestError.InternalError,
          'Implementation error, missing "readersCount".'
        ));
      }

      const boundEndRead = this.endRead.bind(this, key, {writeKey});
      boundEndRead.endRead = boundEndRead.unlock = boundEndRead.release = boundEndRead;

      if (readers === 1) {

        log.debug(chalk.magenta('readers is exactly 1.'));

        return this.lock(writeKey, <any>{rwStatus: RWStatus.LockingWriteKey}, err => {

          if (err) {
            return cb(err, {});
          }

          unlock(err => {

            if (err) {
              return cb(err, {});
            }

            cb(err, boundEndRead);
          });

        });
      }

      unlock(err => {

        if (err) {
          return cb(err, {});
        }

        cb(err, boundEndRead);
      });

    });

  }

  endRead(key: string, opts: any, cb: EndReadCallback) {

    try {
      [key, opts, cb] = this.parseLockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    opts.rwStatus = RWStatus.EndRead;
    opts.max = 1;

    const writeKey = opts.writeKey;

    try {
      assert(writeKey && typeof writeKey === 'string', '"writeKey" must be a string.');
      assert(key !== writeKey, 'writeKey and readKey cannot be the same string.');
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    this.lock(key, opts, (err, v) => {

      if (err) {
        return cb(err);
      }

      const readers = v.readersCount;

      if (!Number.isInteger(readers)) {
        return cb('Implementation error, missing "readersCount".');
      }

      if (readers > 0) {
        return v.unlock(cb);
      }

      // we use force, because this process might not own the writeKey lock
      this.unlock(writeKey, {force: true, rwStatus: RWStatus.UnlockingWriteKey}, err => {

        if (err) {
          return cb(err);
        }

        v.unlock(cb);

      });

    });

  }

}

export const RWLockReadPrefClient = RWLockClient;