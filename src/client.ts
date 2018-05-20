'use strict';

//core
import * as util from 'util';
import * as assert from 'assert';
import * as net from 'net';
import * as fs from 'fs';

//npm
import uuidV4 = require('uuid/v4');
import chalk from "chalk";
import {createParser} from "./json-parser";

//project
export const log = {
  info: console.log.bind(console, chalk.gray.bold('[live-mutex client]')),
  error: console.error.bind(console, chalk.gray.bold('[live-mutex client]'))
};

/////////////////////////////////////////////////////////////////////////

import {weAreDebugging} from './we-are-debugging';
import Timer = NodeJS.Timer;
if (weAreDebugging) {
  log.info('Live-Mutex client is in debug mode. Timeouts are turned off.');
}

/////////////////////////////////////////////////////////////////////////

setTimeout(function () {
  if (process.listenerCount('warning') < 1) {
    log.info(`recommends you attach a process.on('warning') event handler.`);
  }
  if (process.listenerCount('error') < 1) {
    log.info(`recommends you attach a process.on('error') event handler.`);
  }
}, 5000);

const totalNoop = function () {
};

const asyncNoop = function (cb?: Function) {
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

export type ErrFirstDataCallback = (err: any, val?: any) => void;

export interface IClientResolution {
  [key: string]: ErrFirstDataCallback
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

export type LMClientCallBack = (err: any, c?: Client) => void;
export type Ensure = (cb?: LMClientCallBack) => Promise<Client>;

export interface IUuidBooleanHash {
  [key: string]: boolean;
}

export interface LMClientLockOpts {
  
}

export interface LMClientUnlockOpts {
  
}

export interface ILockHolderCount {
  [key: string]: number;
}

export type LMLockSuccessData = {
  acquired: boolean, key: string, unlock?: LMClientUnlockConvenienceCallback, lockUuid: string, id: string
};
export type LMClientLockCallBack = (err: any, val: LMLockSuccessData) => void;
export type LMClientUnlockCallBack = (err: any, uuid?: string) => void;
export type ErrorFirstCallBack = (err: any) => void;
export type LMClientUnlockConvenienceCallback = (fn: ErrorFirstCallBack) => void;

////////////////////////////////////////////////////////////////

const SOCKETFILE = '/tmp/unix.sock';

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
  ws: net.Socket;
  timeouts: IUuidTimeoutBool;
  resolutions: IClientResolution;
  bookkeeping: IBookkeepingHash;
  ensure: Ensure;
  connect: Ensure;
  giveups: IUuidBooleanHash;
  write: Function;
  isOpen: boolean;
  close: Function;
  
  ////////////////////////////////////////////////////////////////
  
  constructor(o: TClientOptions, cb?: LMClientCallBack) {
    
    this.isOpen = false;
    const opts = this.opts = o || {};
    assert(typeof opts === 'object', 'Bad arguments to live-mutex client constructor - options must be an object.');
    
    if (cb) {
      assert(typeof cb === 'function', 'optional second argument to Live-Mutex Client constructor must be a function.');
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
      assert(opts.port > 1024 && opts.port < 49152, ' => "port" integer needs to be in range (1025-49151).');
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
    this.host = opts.host || 'localhost';
    this.port = opts.port || 6970;
    this.ttl = weAreDebugging ? 5000000 : (opts.ttl || 3000);
    this.unlockTimeout = weAreDebugging ? 5000000 : (opts.unlockRequestTimeout || 4000);
    this.lockTimeout = weAreDebugging ? 5000000 : (opts.lockRequestTimeout || 3000);
    this.lockRetryMax = opts.lockRetryMax || 3;
    this.unlockRetryMax = opts.unlockRetryMax || 3;
    
    let ws: net.Socket = null;
    let connectPromise: Promise<any> = null;
    
    const self = this;
    
    this.write = (data: any, cb: Function) => {
      if (!ws) {
        throw new Error('please call ensure()/connect() on this Live-Mutex client, before using the lock/unlock methods.');
      }
      data.pid = process.pid;
      ws.write(JSON.stringify(data) + '\n', 'utf8', cb);
    };
    
    const onData = (data: any) => {
      
      const uuid = data.uuid;
      
      if (uuid) {
        
        if (self.giveups[uuid]) {
          delete self.giveups[uuid];
          return;
        }
        
        const fn = self.resolutions[uuid];
        const to = self.timeouts[uuid];
        
        if (fn && to) {
          process.emit('warning', new Error('Function and timeout both exist => Live-Mutex implementation error.'));
        }
        
        if (fn) {
          fn.call(this, null, data);
        }
        else if (to) {
          
          process.emit('warning', new Error('Client side lock/unlock request timed-out.'));
          
          delete self.timeouts[uuid];
          
          if (data.type === 'lock') {
            self.write({
              uuid: uuid,
              key: data.key,
              type: 'lock-received-rejected'
            });
          }
        }
        else {
          
          process.emit('warning', new Error('Live-mutex implementation warning, ' +
            'no fn with that uuid in the resolutions hash => ' + util.inspect(data)));
          
          if (data.acquired === true && data.type === 'lock') {
            self.write({
              uuid: uuid,
              key: data.key,
              type: 'lock-received-rejected'
            });
          }
        }
      }
      else {
        process.emit('warning', new Error(
          'potential Live-Mutex implementation error => message did not contain uuid =>' + util.inspect(data))
        );
      }
      
    };
    
    this.ensure = this.connect = (cb?: Function) => {
      
      if (cb && typeof cb !== 'function') {
        throw new Error('optional argument to ensure/connect must be a function.');
      }
      
      if (connectPromise && ws.writable) {
        return connectPromise.then((val) => {
            cb && cb.call(self, null, val);
            return val;
          },
          function (err) {
            cb && cb.call(self, err);
            return Promise.reject(err);
          });
      }
      
      if (ws) {
        ws.removeAllListeners();
        ws.destroy(function (err) {
          err && log.error(err.message || err);
        });
      }
      
      return connectPromise = new Promise((resolve, reject) => {
        
        let onFirstErr = function (e: any) {
          let err = new Error('live-mutex client error => ' + (e && e.stack || e));
          process.emit('warning', err);
          reject(err);
        };
        
        let to = setTimeout(function () {
          reject('live-mutex err: client connection timeout after 2000ms.');
        }, 3000);
        
        ws = net.createConnection({port: self.port}, () => {
          self.isOpen = true;
          clearTimeout(to);
          ws.removeListener('error', onFirstErr);
          resolve(this);
        });
        
        // ws = net.createConnection(SOCKETFILE, () => {
        //   self.isOpen = true;
        //   clearTimeout(to);
        //   ws.removeListener('error', onFirstErr);
        //   resolve(this);
        // });
        
        ws.once('end', () => {
          process.emit('warning', new Error('client stream "end" event occurred.'));
        });
        
        ws.once('error', onFirstErr);
        ws.once('close', () => {
          self.isOpen = false;
        });
        
        ws.setEncoding('utf8');
        
        ws.on('error', function (e) {
          process.emit('warning', new Error('live-mutex client error: ' + e.stack || util.inspect(e)));
        });
        
        ws.pipe(createParser())
        .on('data', onData)
        .once('error', function (e: any) {
          self.write({error: String(e && e.stack || e)}, function () {
            ws.end();
          });
        });
      })
      // if the user passes a callback, we fire the callback here
      .then((val) => {
          cb && cb.call(self, null, val);
          return val;
        },
        err => {
          cb && cb.call(self, err);
          return Promise.reject(err);
        });
    };
    
    process.once('exit', () => {
      ws && ws.end();
    });
    
    this.close = () => {
      return ws && ws.end();
    };
    
    this.bookkeeping = {};
    this.timeouts = {};
    this.resolutions = {};
    this.giveups = {};
    
    // if the user passes a callback, we call connect here
    // on behalf of the user
    cb && this.connect(cb);
    
  };
  
  static create(opts: TClientOptions): Client {
    return new Client(opts);
  }
  
  requestLockInfo(key: string, opts?: any, cb?: Function) {
    
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
        throw new Error('Live-Mutex implementation error => bad key.');
      }
      
      if (data.error) {
        process.emit('warning', data.error);
      }
      
      if ([data.acquired, data.retry].filter(i => i).length > 1) {
        throw new Error('Live-Mutex implementation error.');
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
  
  lockp(key: string, opts?: Partial<LMClientLockOpts>): Promise<LMLockSuccessData> {
    return new Promise((resolve, reject) => {
      this.lock(key, opts, function (err, val) {
        err ? reject(err) : resolve(val);
      });
    });
  }
  
  unlockp(key: string, opts?: Partial<LMClientUnlockOpts>) {
    return new Promise((resolve, reject) => {
      this.unlock(key, opts, function (err, val) {
        err ? reject(err) : resolve(val);
      });
    });
  }
  
  acquire(key: string, opts?: Partial<LMClientLockOpts>) {
    return this.lockp.apply(this, arguments);
  }
  
  release(key: string, opts?: Partial<LMClientUnlockOpts>) {
    return this.unlockp.apply(this, arguments);
  }
  
  acquireLock(key: string, opts?: Partial<LMClientLockOpts>) {
    return this.lockp.apply(this, arguments);
  }
  
  releaseLock(key: string, opts?: Partial<LMClientUnlockOpts>) {
    return this.unlockp.apply(this, arguments);
  }
  
  promisifyUnlock(fn: Function) {
    return new Promise((resolve, reject) => {
      fn(function (err, val) {
        err ? reject(err) : resolve(val);
      });
    });
  }
  
  private cleanUp(to: Timer, uuid: string) {
    clearTimeout(to);
    delete this.resolutions[uuid];
  }
  
  private callbackWithError(err: any, uuid: string, cb: Function, key: string, to: Timer) {
    this.cleanUp(to, uuid);
    err = err instanceof Error ? err : new Error(err);
    process.emit('warning', err);
    cb(err, {acquired: false, key, lockUuid: uuid});
  };
  
  lock(key: string, opts: any, cb?: LMClientLockCallBack) {
    
    assert.equal(typeof key, 'string', 'Key passed to live-mutex #lock needs to be a string.');
    
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
      opts = {force: opts};
    }
    else if (typeof opts === 'number') {
      opts = {ttl: opts};
    }
    
    opts = opts || {} as TClientOptions;
    
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
      return cb(new Error(`Maximum retries (${maxRetries}) attempted.`), {
        acquired: false,
        key,
        lockUuid: uuid,
        id: uuid
      });
    }
    
    const self = this;
    let timedOut = false;
    const to = setTimeout(() => {
      
      timedOut = true;
      // this.timeouts[uuid] = true;
      delete self.resolutions[uuid];
      self.write({uuid, key, type: 'lock-client-timeout'});
      ++opts.__retryCount;
      
      log.error(`retrying lock request for key '${key}', uuid '${uuid}', attempt #`, opts.__retryCount);
      
      if (opts.__retryCount >= maxRetries) {
        return cb(new Error(` => Live-Mutex client lock request timed out after ${lockTimeout * opts.__retryCount} ms, ` +
          `${maxRetries} retries attempted.`),
          {acquired: false, key, lockUuid: uuid, id: uuid});
      }
      
      self.lock(key, opts, cb);
    }, lockTimeout);
    
    this.resolutions[uuid] = (err, data) => {
      
      if (timedOut) {
        return;
      }
      
      if (err) {
        return this.callbackWithError(err, uuid, cb, key, to);
      }
      
      if (!data) {
        return this.callbackWithError('no data received from broker.', uuid, cb, key, to);
      }
      
      if (data.uuid !== uuid) {
        return this.callbackWithError(
          `Live-Mutex error, mismatch in uuids -> '${data.uuid}', -> '${uuid}'.`,
          uuid, cb, key, to
        );
      }
      
      if (String(key) !== String(data.key)) {
        return this.callbackWithError(
          `Live-Mutex bad key, [1] => '${key}', [2] -> ${data.key}`,
          uuid, cb, key, to
        );
      }
      
      if (data.error) {
        return this.callbackWithError(data.error, uuid, cb, key, to);
      }
      
      if (data.acquired === true) {
        
        this.cleanUp(to, uuid);
        self.bookkeeping[key].lockCount++;
        self.write({uuid: uuid, key: key, type: 'lock-received'});
        const boundUnlock = self.unlock.bind(self, key, {_uuid: uuid});
        boundUnlock.acquired = true;
        boundUnlock.key = key;
        boundUnlock.unlock = boundUnlock;
        boundUnlock.lockUuid = data.uuid;
        cb(null, boundUnlock);
        
      }
      else if (data.reelection === true) {
        
        this.cleanUp(to, uuid);
        self.lock(key, opts, cb);
        
      }
      else if (data.acquired === false) {
        
        if (opts.wait === false) {
          this.cleanUp(to, uuid);
          self.giveups[uuid] = true;
          cb(null, {
            key,
            acquired: false,
            lockUuid: uuid,
            id: uuid
          });
        }
        
      }
      else {
        this.callbackWithError(`fallthrough in condition [1]`, uuid, cb, key, to);
      }
      
    };
    
    this.write({
      isViaShell: opts.isViaShell,
      retryCount: opts.__retryCount,
      uuid: uuid,
      key: key,
      type: 'lock',
      ttl: ttl
    });
    
  }
  
  noop() {
  
  }
  
  unlock(key: string, opts?: any, cb?: LMClientUnlockCallBack) {
    
    assert.equal(typeof key, 'string', 'Key passed to live-mutex #unlock needs to be a string.');
    
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
      opts = {force: opts};
    }
    else if (typeof opts === 'string') {
      opts = {_uuid: opts};
    }
    
    opts = opts || {};
    cb && (cb = cb.bind(this));
    cb = cb || this.noop;
    
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
    
    this.resolutions[uuid] = (err, data) => {
      
      if (timedOut) {
        return;
      }
      
      if (err) {
        return this.callbackWithError(err, uuid, cb, key, to);
      }
      
      if (!data) {
        return this.callbackWithError('Live-Mutex implementation error, bad key.',
          uuid, cb, key, to);
      }
      
      if (String(key) !== String(data.key)) {
        return this.callbackWithError('Live-Mutex implementation error, bad key.',
          uuid, cb, key, to);
      }
      
      if (data.error) {
        return this.callbackWithError(data.error, uuid, cb, key, to);
      }
      
      if (data.unlocked === true) {
        this.cleanUp(to, uuid);
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
        this.cleanUp(to, uuid);
        cb && cb(data);
      }
      else {
        this.callbackWithError('fallthrough in conditional [2], Live-Mutex failure.',
          uuid, cb, key, to);
      }
      
    };
    
    let force = (opts.__retryCount > 0) ? true : Boolean(opts.force);
    
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
export default Client;
export const LMClient = Client;
export const LvMtxClient = Client;
