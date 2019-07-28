'use strict';

//core
import * as assert from 'assert';

//npm
import chalk from "chalk";
import UUID = require('uuid');

//project
import {Client, ClientOpts, LMClientCallBack, LMClientUnlockCallBack} from "./client";
import {weAreDebugging} from "./we-are-debugging";
import {EVCb} from "./utils";


/////////////////////////////////////////////////////////////////////////////////

export const log = {
  info: console.log.bind(console, chalk.gray.bold('[lmx client info]')),
  warn: console.error.bind(console, chalk.magenta.bold('[lmx client warning]')),
  error: console.error.bind(console, chalk.red.bold('[lmx client error]')),
  debug: function (...args: any[]) {
    weAreDebugging && console.log('[lmx debugging]', ...args);
  }
};

///////////////////////////////////////////////////////////////////////////////////////////////

export class RWLockWritePrefClient extends Client {

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
    const boundRelease = this.releaseWriteLock.bind(this, key, {});

    this.lock(key, opts, (err, unlock) => {

      if (err) {
        return cb(err, boundRelease);
      }

      log.debug(chalk.blue('acquireWriteLock got lock on:'), key);

      this.registerWriteFlagAndReadersCheck(key, {}, (err, val) => {

        if (err) {
          return cb(err, boundRelease);
        }

        unlock((err, val) => {
          log.debug(chalk.blue('acquireWriteLock released lock on:'), key);
          cb(err, boundRelease);
        });

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

    // const boundRelease = this.releaseWriteLock.bind(this, key, {});

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
          log.debug(chalk.blue('releaseWriteLock released lock on:'), key);
          cb(err, val);
        });

      });

    });

  }

  acquireReadLock(key: string, opts: any, cb: EVCb<any>) {

    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      return process.nextTick(cb, err);
    }

    const boundRelease = this.releaseReadLock.bind(this, key, {});

    opts.max = 1;

    this.lock(key, opts, (err, unlock) => {

      if (err) {
        return cb(err, boundRelease);
      }


      log.debug(chalk.blue('acquireReadLock got lock on key:'), key);

      this.registerWriteFlagCheck(key, {}, (err, val) => {

        if (err) {
          return cb(err, boundRelease);
        }

        log.debug(chalk.magenta('client got register-write-flag-and-readers-check-success'));


        unlock((err, val) => {
          log.debug(chalk.blue('acquireReadLock released lock on key:'), key);
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