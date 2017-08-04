'use strict';

//core
import * as util from 'util';
import * as path from 'path';
import * as assert from 'assert';
import * as EE from 'events';
import {CWebSocket} from "./dts/uws";
import Timer = NodeJS.Timer;
import * as net from 'net';

//npm
const uuidV4 = require('uuid/v4');
const colors = require('chalk');
const JSONStream = require('JSONStream');

//project
const debug = require('debug')('live-mutex');
import lmUtils from './utils';

const loginfo = console.log.bind(console, ' [live-mutex client] =>');
const logerr = console.error.bind(console, ' [live-mutex client] =>');

/////////////////////////////////////////////////////////////////////////

const weAreDebugging = require('./lib/we-are-debugging');
if (weAreDebugging) {
  loginfo('Live-Mutex client is in debug mode. Timeouts are turned off.');
}

/////////////////////////////////////////////////////////////////////////

setTimeout(function () {
  if (process.listenerCount('warning') < 1) {
    loginfo(`recommends you attach a process.on('warning') event handler.`);
  }
}, 1000);

const totalNoop = function () {
};

const asyncNoop = function (cb) {
  cb && process.nextTick(cb);
};

const validOptions: Array<string> = [
  'key',
  'listener',
  'host',
  'port',
  'unlockRequestTimeout',
  'lockRequestTimeout',
  'unlockRetryMax',
  'lockRetryMax'
];

////////////////// typings /////////////////////////////////////////////

export interface IClientOptions {
  key: string,
  listener: Function,
  host: string,
  port: number
  unlockRequestTimeout: number;
  lockRequestTimeout: number;
  unlockRetryMax: number;
  lockRetryMax: number;
  ttl: number
}

export type TClientOptions = Partial<IClientOptions>

export interface IUuidTimeoutBool {
  [key: string]: boolean
}

export type IErrorFirstDataCB = (err: Error | null | undefined | string, val?: any) => void;

export interface IClientResolution {
  [key: string]: IErrorFirstDataCB
}

export interface IBookkeepingHash {
  [key: string]: IBookkeeping;
}

export interface IBookkeeping {
  rawLockCount: number,
  rawUnlockCount: number;
  lockCount: number;
  unlockCount: number;
}

export type TClientCB = (err: Error | string | null | undefined, c?: Client) => void;
export type TEnsure = (cb?: TClientCB) => Promise<Client>;

export interface IUuidBooleanHash {
  [key: string]: boolean;
}

export interface IClientLockOpts {

}

export interface IClientUnlockOpts {

}

export interface ILockHolderCount {
  [key: string]: number;
}

export type TClientLockCB = (err: Error | string | null | undefined, unlock: Function | false, id?: string) => void;
export type TClientUnlockCB = (err: Error | string | null | undefined, uuid?: string) => void;

////////////////////////////////////////////////////////////////

export class Client {

  port: number;
  host: string;
  listeners: Object;
  opts: TClientOptions;
  ttl: number;
  unlockTimeout: number;
  lockTimeout: number;
  lockRetryMax: number;
  unlockRetryMax: number;
  ws: CWebSocket;
  timeouts: IUuidTimeoutBool;
  resolutions: IClientResolution;
  bookkeeping: IBookkeepingHash;
  ensure: TEnsure;
  connect: TEnsure;
  giveups: IUuidBooleanHash;
  write: Function;
  isOpen: boolean;
  lockholderCount: ILockHolderCount;
  close: Function;

  ////////////////////////////////////////////////////////////////

  constructor($opts: TClientOptions, cb?: TClientCB) {

    this.isOpen = false;
    const opts = this.opts = $opts || {};
    assert(typeof opts === 'object', ' => Bad arguments to live-mutex client constructor.');

    if (cb) {
      assert(typeof cb === 'function',
        'optional second argument to Live-Mutex Client constructor must be a function.');
      cb = cb.bind(this)
    }

    Object.keys(opts).forEach(function (key) {
      if (validOptions.indexOf(key) < 0) {
        throw new Error(' => Option passed to Live-Mutex#Client constructor is ' +
          'not a recognized option => "' + key + '"');
      }
    });

    if ('host' in opts) {
      assert(typeof opts.host === 'string', ' => "host" option needs to be a string.');
    }

    if ('port' in opts) {

      assert(Number.isInteger(opts.port), ' => "port" option needs to be an integer.');
      assert(opts.port > 1024 && opts.port < 49152,
        ' => "port" integer needs to be in range (1025-49151).');
    }

    if ('listener' in opts) {
      assert(typeof opts.listener === 'function', ' => Listener should be a function.');
      assert(typeof opts.key === 'string', ' => You must pass in a key to use listener functionality.');
    }

    if ('unlockRetryMax' in opts) {
      assert(Number.isInteger(opts.unlockRetryMax),
        ' => "unlockRetryMax" option needs to be an integer.');
      assert(this.opts.unlockRetryMax >= 0 && opts.unlockRetryMax <= 100,
        ' => "unlockRetryMax" integer needs to be in range (0-100).');
    }

    if ('lockRetryMax' in opts) {
      assert(Number.isInteger(opts.lockRetryMax),
        ' => "lockRetryMax" option needs to be an integer.');
      assert(opts.lockRetryMax >= 0 && opts.lockRetryMax <= 100,
        ' => "lockRetryMax" integer needs to be in range (0-100).');
    }

    if ('unlockRequestTimeout' in opts) {
      assert(Number.isInteger(opts.unlockRequestTimeout),
        ' => "unlockRequestTimeout" option needs to be an integer (representing milliseconds).');
      assert(opts.unlockRequestTimeout >= 20 && opts.unlockRequestTimeout <= 800000,
        ' => "unlockRequestTimeout" needs to be integer between 20 and 800000 millis.');
    }

    if ('lockRequestTimeout' in opts) {
      assert(Number.isInteger(opts.lockRequestTimeout),
        ' => "lockRequestTimeout" option needs to be an integer (representing milliseconds).');
      assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000,
        ' => "lockRequestTimeout" needs to be integer between 20 and 800000 millis.');
    }

    if ('ttl' in opts) {
      assert(Number.isInteger(opts.ttl),
        ' => "ttl" option needs to be an integer (representing milliseconds).');
      assert(opts.ttl >= 3 && opts.ttl <= 800000,
        ' => "ttl" needs to be integer between 3 and 800000 millis.');
    }

    this.listeners = {};

    if (opts.listener) {
      const a = this.listeners[opts.key] = [];
      a.push(opts.listener);
    }

    this.host = opts.host || 'localhost';
    this.port = opts.port || 6970;
    this.ttl = weAreDebugging ? 5000000 : ( opts.ttl || 3000);
    this.unlockTimeout = weAreDebugging ? 5000000 : (opts.unlockRequestTimeout || 3000);
    this.lockTimeout = weAreDebugging ? 5000000 : (opts.lockRequestTimeout || 6000);
    this.lockRetryMax = opts.lockRetryMax || 3;
    this.unlockRetryMax = opts.unlockRetryMax || 3;

    let ws = null;
    let connectPromise = null;

    this.write = function (data, cb) {
      if (ws) {
        data.pid = process.pid;
        ws.write(JSON.stringify(data) + '\n', 'utf8', cb);
      }
      else {
        throw new Error('please call connect() on this Live-Mutex client, before using the lock/unlock methods.');
      }
    };

    const onData = data => {

      if (data.type === 'stats') {
        this.setLockRequestorCount(data.key, data.lockRequestCount);
        return;
      }

      const uuid = data.uuid;

      if (uuid) {

        if (this.giveups[uuid]) {
          delete this.giveups[uuid];
          return;
        }

        const fn = this.resolutions[uuid];
        const to = this.timeouts[uuid];

        if (fn && to) {
          throw new Error('Function and timeout both exist => Live-Mutex implementation error.');
        }

        if (fn) {
          fn.call(this, null, data);
        }
        else if (to) {

          logerr('Client side lock/unlock request timed-out.');

          delete this.timeouts[uuid];

          if (data.type === 'lock') {
            this.write({
              uuid: uuid,
              key: data.key,
              type: 'lock-received-rejected'
            });
          }
        }
        else {
          logerr('Live-mutex implementation error, ' +
            'no fn with that uuid in the resolutions hash => \n' + util.inspect(data));
          if(data.acquired === true && data.type === 'lock'){
            this.write({
              uuid: uuid,
              key: data.key,
              type: 'lock-received-rejected'
            });
          }
        }
      }
      else {
        logerr(colors.yellow('Live-Mutex implementation issue => message did not contain uuid =>'),
          '\n', util.inspect(data));
      }

    };

    this.ensure = this.connect = function (cb?: Function) {

      if (connectPromise) {
        return connectPromise;
      }

      return connectPromise = new Promise((resolve, reject) => {

        let onFirstErr = function (e) {
          let err = new Error('live-mutex client error => ' + (e.stack || e));
          process.emit('warning', err);
          reject(err);
        };

        let to = setTimeout(function () {
          reject('live-mutex err: client connection timeout after 2000ms.');
        }, 3000);

        ws = net.createConnection({port: this.port}, () => {
          this.isOpen = true;
          clearTimeout(to);
          ws.removeListener('error', onFirstErr);
          resolve(this);
        });

        ws.once('end', () => {
          loginfo('client stream "end" event occurred.');
        });

        ws.once('error', onFirstErr);
        ws.on('close', () => {
          this.isOpen = false;
        });

        ws.setEncoding('utf8');

        ws.on('error', function (e) {
          logerr('client error', e.stack || e);
        });

        ws.pipe(JSONStream.parse()).on('data', onData)
        .once('error', function (e) {
          this.write({
            error: String(e.stack || e)
          }, function () {
            ws.end();
          });
        });
      })
      // if the user passes a callback, we fire the callback here
      .then(val => {
          cb && (cb = cb.bind(this)) && cb(null, val);
          return val;
        },
        err => {
          cb && (cb = cb.bind(this)) && cb(err);
          return Promise.reject(err);
        });
    };

    process.once('exit', function () {
      ws && ws.end();
    });

    this.close = function () {
      return ws && ws.end();
    };

    this.bookkeeping = {};
    this.lockholderCount = {};
    this.timeouts = {};
    this.resolutions = {};
    this.giveups = {};

    // if the user passes a callback, we call connect here
    // on behalf of the user
    cb && this.connect(cb);

  };

  static create(opts: TClientOptions, cb?: TClientCB): Promise<Client> {
    return new Client(opts).ensure(cb);
  }

  addListener(key, fn) {
    assert.equal(typeof key, 'string', ' => Key is not a string.');
    assert.equal(typeof fn, 'function', ' => fn is not a function type.');
    const a = this.listeners[key] = this.listeners[key] || [];
    a.push(fn);
  }

  setLockRequestorCount(key, val): void {
    this.lockholderCount[key] = val;
    const a = this.listeners[key] = this.listeners[key] || [];
    for (let i = 0; i < a.length; i++) {
      a[i].call(null, val);
    }
  }

  getLockholderCount(key): number {
    return this.lockholderCount[key] || 0;
  }

  requestLockInfo(key, opts, cb) {

    assert.equal(typeof key, 'string', ' => Key passed to live-mutex#lock needs to be a string.');

    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }

    opts = opts || {};
    const uuid = opts._uuid || uuidV4();

    this.resolutions[uuid] = (err, data) => {
      if (String(key) !== String(data.key)) {
        delete this.resolutions[uuid];
        throw new Error(' => Live-Mutex implementation error => bad key.');
      }

      if (data.error) {
        logerr(colors.bgRed(data.error), '\n');
      }

      if ([data.acquired, data.retry].filter(i => i).length > 1) {
        throw new Error(' => Live-Mutex implementation error.');
      }

      if (data.lockInfo === true) {
        delete this.resolutions[uuid];
        cb(null, {data: data});
      }
    };

    this.write({
      uuid: uuid,
      key: key,
      type: 'lock-info-request',
    });

  }

  lockp(key: string, opts: Partial<IClientLockOpts>) {
    return new Promise((resolve, reject) => {
      this.lock(key, opts, function (err, unlock, lockUuid) {
        err ? reject(err) : resolve({key, unlock, lockUuid});
      });
    });
  }

  unlockp(key: string, opts: Partial<IClientUnlockOpts>) {
    return new Promise((resolve, reject) => {
      this.unlock(key, opts, function (err, val) {
        err ? reject(err) : resolve(val);
      });
    });
  }

  lock(key: string, opts: Partial<IClientLockOpts>, cb: TClientLockCB) {

    assert.equal(typeof key, 'string', 'Key passed to live-mutex#lock needs to be a string.');

    this.bookkeeping[key] = this.bookkeeping[key] || {
      rawLockCount: 0,
      rawUnlockCount: 0,
      lockCount: 0,
      unlockCount: 0
    };

    this.bookkeeping[key].rawLockCount++;

    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    else if (typeof opts === 'boolean') {
      opts = {
        force: opts
      };
    }
    else if (typeof opts === 'number') {
      opts = {
        ttl: opts
      };
    }

    opts = opts || {};

    assert(typeof cb === 'function', 'callback function must be passed to Client lock() method.');
    cb = cb.bind(this);

    if ('append' in opts) {
      assert.equal(typeof opts.append, 'string', ' => Live-Mutex usage error => ' +
        '"append" option must be a string value.');
    }

    if ('force' in opts) {
      assert.equal(typeof opts.force, 'boolean', ' => Live-Mutex usage error => ' +
        '"force" option must be a boolean value. Coerce it on your side, for safety.');
    }

    if ('maxRetries' in opts) {
      assert(Number.isInteger(opts.maxRetries), '"retry" option must be an integer.');
      assert(opts.maxRetries >= 0 && opts.maxRetries <= 20,
        '"retry" option must be an integer between 0 and 20 inclusive.');
    }

    if ('maxRetry' in opts) {
      assert(Number.isInteger(opts.maxRetry), '"retry" option must be an integer.');
      assert(opts.maxRetry >= 0 && opts.maxRetry <= 20,
        '"retry" option must be an integer between 0 and 20 inclusive.');
    }

    if ('ttl' in opts) {
      assert(Number.isInteger(opts.ttl),
        ' => Live-Mutex usage error => Please pass an integer representing milliseconds as the value for "ttl".');
      assert(opts.ttl >= 3 && opts.ttl <= 800000,
        ' => Live-Mutex usage error => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
    }

    if ('lockRequestTimeout' in opts) {
      assert(Number.isInteger(opts.lockRequestTimeout),
        ' => Please pass an integer representing milliseconds as the value for "ttl".');
      assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000,
        ' => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
    }

    opts.__retryCount = opts.__retryCount || 0;

    if (opts.__retryCount > 0) {
      assert(opts._uuid, 'Live-Mutex internal error: no _uuid past to retry call.');
    }

    const append = opts.append || '';
    assert(typeof append === 'string', 'append option to lock() method must be of type "string".');

    const uuid = opts._uuid = opts._uuid || (append + uuidV4());
    const ttl = opts.ttl || this.ttl;
    const lockTimeout = opts.lockRequestTimeout || this.lockTimeout;
    const maxRetries = opts.maxRetry || opts.maxRetries || this.lockRetryMax;

    if (opts.__retryCount > maxRetries) {
      return cb(new Error(`Maximum retries (${maxRetries}) attempted.`), false);
    }

    let timedOut = false;
    const to = setTimeout(() => {

      timedOut = true;
      // this.timeouts[uuid] = true;
      delete this.resolutions[uuid];

      this.write({
        uuid,
        key,
        type: 'lock-client-timeout'
      });

      ++opts.__retryCount;

      if (opts.__retryCount > maxRetries) {
        return cb(new Error(`Live-Mutex client lock request timed out after ${lockTimeout}ms,
         ${maxRetries} retries attempted.`), false);
      }

      // logerr(`retrying lock request for uuid ${uuid}, attempt #`, opts.__retryCount);
      this.lock(key, opts, cb);

    }, lockTimeout);

    let cleanUp = () => {
      clearTimeout(to);
      delete this.resolutions[uuid];
    };

    let callbackWithError = (errMsg) => {
      cleanUp();
      let err = errMsg instanceof Error ? errMsg : new Error(errMsg);
      process.emit('warning', err);
      cb(err, false);
    };

    this.resolutions[uuid] = (err, data) => {

      if (timedOut) {
        return;
      }

      if (err) {
        return callbackWithError(err);
      }

      if (String(key) !== String(data.key)) {
        return callbackWithError(`Live-Mutex bad key, 1 -> ', ${key}, 2 -> ${data.key}`);
      }

      this.setLockRequestorCount(key, data.lockRequestCount);

      if (data.error) {
        return callbackWithError(data.error);
      }

      if (data.acquired === true) {
        cleanUp();
        this.bookkeeping[key].lockCount++;

        this.write({
          uuid: uuid,
          key: key,
          type: 'lock-received'
        });

        if (data.uuid !== uuid) {
          return callbackWithError(`Live-Mutex error, mismatch in uuids -> '${data.uuid}', -> '${uuid}'.`);
        }
        else {

          // cb(null, {
          //   key,
          //   unlock: this.unlock.bind(this, key, {_uuid: uuid}),
          //   lockUuid: data.uuid,
          // });

          cb(null, this.unlock.bind(this, key, {_uuid: uuid}), data.uuid);
        }
      }

      else if (data.reelection === true) {
        cleanUp();
        this.lock(key, opts, cb);
      }
      else if (data.acquired === false) {
        if (opts.wait === false) {
          cleanUp();
          this.giveups[uuid] = true;
          cb(null, false, data.uuid);
        }
      }
      else {
        callbackWithError(`fallthrough in condition [1]`);
      }

    };

    this.write({
      retryCount: opts.__retryCount,
      uuid: uuid,
      key: key,
      type: 'lock',
      ttl: ttl
    });

  }

  unlock(key: string, opts: Partial<IClientUnlockOpts>, cb?: TClientUnlockCB) {

    assert.equal(typeof key, 'string', 'Key passed to live-mutex#unlock needs to be a string.');

    this.bookkeeping[key] = this.bookkeeping[key] || {
      rawLockCount: 0,
      rawUnlockCount: 0,
      lockCount: 0,
      unlockCount: 0
    };

    this.bookkeeping[key].rawUnlockCount++;

    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    else if (typeof opts === 'boolean') {
      opts = {
        force: opts
      };
    }
    else if (typeof opts === 'string') {
      opts = {
        _uuid: opts
      };
    }

    opts = opts || {};
    cb && (cb = cb.bind(this));

    if ('force' in opts) {
      assert.equal(typeof opts.force, 'boolean', ' => Live-Mutex usage error => ' +
        '"force" option must be a boolean value. Coerce it on your side, for safety.');
    }

    if ('unlockRequestTimeout' in opts) {
      assert(Number.isInteger(opts.lockRequestTimeout),
        ' => Please pass an integer representing milliseconds as the value for "ttl".');
      assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000,
        ' => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
    }

    const uuid = uuidV4();
    const unlockTimeout = opts.unlockRequestTimeout || this.unlockTimeout;

    let timedOut = false;

    const to = setTimeout(() => {

      timedOut = true;
      delete this.resolutions[uuid];
      this.timeouts[uuid] = true;
      let err = new Error('Unlock request timed out.');
      process.emit('warning', err);
      cb && cb(err);

    }, unlockTimeout);

    let cleanUp = () => {
      clearTimeout(to);
      delete this.resolutions[uuid];
    };

    let callbackWithError = (errMsg) => {
      cleanUp();
      let err = errMsg instanceof Error ? errMsg : new Error(errMsg);
      process.emit('warning', err);
      cb && cb(err);
    };

    this.resolutions[uuid] = (err, data) => {

      if (timedOut) {
        return;
      }

      this.setLockRequestorCount(key, data.lockRequestCount);

      if (String(key) !== String(data.key)) {
        return callbackWithError('Live-Mutex implementation error, bad key.');
      }

      if (data.error) {
        return callbackWithError(data.error);
      }

      if (data.unlocked === true) {
        cleanUp();
        this.bookkeeping[key].unlockCount++;
        this.write({
          uuid: uuid,
          key: key,
          type: 'unlock-received'
        });

        cb && cb(null, data.uuid);
      }
      else if (data.unlocked === false) {
        // data.error will most likely be defined as well
        // so this may never get hit
        cleanUp();
        cb && cb(data);
      }
      else {
        callbackWithError('fallthrough in conditional [2], Live-Mutex failure.');
      }

    };

    let force = (opts.__retryCount > 0) ? true : !!opts.force;

    this.write({
      _uuid: opts._uuid,
      uuid: uuid,
      key: key,
      // we only use force if we have to retry
      force: force,
      type: 'unlock'
    });
  }

}

// aliases
export const LMClient = Client;
export const LvMtxClient = Client;
export default Client;