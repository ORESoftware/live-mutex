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
  warning: console.error.bind(console, chalk.magenta.bold('[live-mutex client]')),
  error: console.error.bind(console, chalk.red.bold('[live-mutex client]')),
  debug: function (...args: any[]) {
    weAreDebugging && console.log('[live-mutex debugging]', ...args);
  }
};

/////////////////////////////////////////////////////////////////////////

import {weAreDebugging} from './we-are-debugging';
import Timer = NodeJS.Timer;
import {EventEmitter} from 'events';
if (weAreDebugging) {
  log.debug('Live-Mutex client is in debug mode. Timeouts are turned off.');
}

/////////////////////////////////////////////////////////////////////////

export const validConstructorOptions = {
  key: 'string',
  listener: 'Function',
  host: 'string',
  port: 'integer',
  ttl: 'integer',
  unlockRequestTimeout: 'integer in millis',
  lockRequestTimeout: 'integer in millis',
  unlockRetryMax: 'integer',
  lockRetryMax: 'integer',
  keepLocksAfterDeath: 'boolean'
};

export const validLockOptions = {
  force: 'boolean',
  maxRetries: 'integer',
  maxRetry: 'integer',
  ttl: 'integer in millis',
  lockRequestTimeout: 'integer in millis',
  keepLocksAfterDeath: 'boolean'
};

export const validUnlockOptions = {
  force: 'boolean',
  unlockRequestTimeout: 'integer',
  keepLocksAfterDeath: 'boolean'
};

export interface ClientOpts {
  key: string,
  listener: Function,
  host: string,
  port: number
  unlockRequestTimeout: number;
  lockRequestTimeout: number;
  unlockRetryMax: number;
  lockRetryMax: number;
  ttl: number,
  keepLocksAfterDeath: boolean,
  keepAnyLocksAfterExit: boolean
}

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

export interface UuidBooleanHash {
  [key: string]: boolean;
}

export interface LMClientLockOpts {
  
}

export interface LMClientUnlockOpts {
  
}

export type LMLockSuccessData = {
  acquired: boolean, key: string, unlock?: LMClientUnlockConvenienceCallback, lockUuid: string, id: string
};

export interface LMClientLockCallBack {
  isLMBound?: boolean;
  (err: any, val: LMLockSuccessData): void;
}

export type LMClientUnlockCallBack = (err: any, uuid?: string) => void;
export type ErrorFirstCallBack = (err: any) => void;
export type LMClientUnlockConvenienceCallback = (fn: ErrorFirstCallBack) => void;

//////////////////////////////////////////////////////////////////////////////////////////

export class Client {
  
  port: number;
  host: string;
  listeners: Object;
  opts: Partial<ClientOpts>;
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
  giveups: UuidBooleanHash;
  timers: { [key: string]: Timer };
  write: Function;
  isOpen: boolean;
  close: Function;
  lockQueues = {}  as { [key: string]: Array<any> };
  keepLocksAfterDeath = false;
  emitter = new EventEmitter();
  
  ////////////////////////////////////////////////////////////////
  
  constructor(o: Partial<ClientOpts>, cb?: LMClientCallBack) {
    
    this.isOpen = false;
    const opts = this.opts = o || {};
    assert(typeof opts === 'object', 'Bad arguments to live-mutex client constructor - options must be an object.');
    
    if (cb) {
      assert(typeof cb === 'function', 'optional second argument to Live-Mutex Client constructor must be a function.');
      cb = cb.bind(this);
      if (process.domain) {
        cb = process.domain.bind(cb);
      }
    }
    
    Object.keys(opts).forEach(function (key) {
      if (!validConstructorOptions[key]) {
        throw new Error('An option passed to Live-Mutex Client constructor is ' +
          `not a recognized option => "${key}", \n valid options are: ` + util.inspect(validConstructorOptions));
      }
    });
    
    if (opts['host']) {
      assert(typeof opts.host === 'string', ' => "host" option needs to be a string.');
    }
    
    if (opts['port']) {
      assert(Number.isInteger(opts.port), ' => "port" option needs to be an integer.');
      assert(opts.port > 1024 && opts.port < 49152, ' => "port" integer needs to be in range (1025-49151).');
    }
    
    if (opts['listener']) {
      assert(typeof opts.listener === 'function', ' => Listener should be a function.');
      assert(typeof opts.key === 'string', ' => You must pass in a key to use listener functionality.');
    }
    
    if (opts['unlockRetryMax']) {
      assert(Number.isInteger(opts.unlockRetryMax),
        ' => "unlockRetryMax" option needs to be an integer.');
      assert(this.opts.unlockRetryMax >= 0 && opts.unlockRetryMax <= 100,
        ' => "unlockRetryMax" integer needs to be in range (0-100).');
    }
    
    if (opts['lockRetryMax']) {
      assert(Number.isInteger(opts.lockRetryMax),
        ' => "lockRetryMax" option needs to be an integer.');
      assert(opts.lockRetryMax >= 0 && opts.lockRetryMax <= 100,
        ' => "lockRetryMax" integer needs to be in range (0-100).');
    }
    
    if (opts['unlockRequestTimeout']) {
      assert(Number.isInteger(opts.unlockRequestTimeout),
        ' => "unlockRequestTimeout" option needs to be an integer (representing milliseconds).');
      assert(opts.unlockRequestTimeout >= 20 && opts.unlockRequestTimeout <= 800000,
        ' => "unlockRequestTimeout" needs to be integer between 20 and 800000 millis.');
    }
    
    if (opts['lockRequestTimeout']) {
      assert(Number.isInteger(opts.lockRequestTimeout),
        ' => "lockRequestTimeout" option needs to be an integer (representing milliseconds).');
      assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000,
        ' => "lockRequestTimeout" needs to be integer between 20 and 800000 millis.');
    }
    
    if (opts['ttl']) {
      assert(Number.isInteger(opts.ttl),
        ' => "ttl" option needs to be an integer (representing milliseconds).');
      assert(opts.ttl >= 3 && opts.ttl <= 800000,
        ' => "ttl" needs to be integer between 3 and 800000 millis.');
    }
    
    if ('keepLocksAfterDeath' in opts) {
      assert(typeof opts.keepLocksAfterDeath === 'boolean',
        ' => "keepLocksAfterDeath" option needs to be a boolean.');
    }
    
    this.keepLocksAfterDeath = Boolean(opts.keepLocksAfterDeath);
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
      
      if ('keepLocksAfterDeath' in data) {
        data.keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
      }
      else {
        data.keepLocksAfterDeath = this.keepLocksAfterDeath;
      }
      
      ws.write(JSON.stringify(data) + '\n', 'utf8', cb);
    };
    
    const onData = (data: any) => {
      
      const uuid = data.uuid;
      
      log.debug('client received data:', util.inspect(data, {breakLength: Infinity}));
      
      if (!uuid) {
        return this.emitter.emit('warning', new Error(
          'Potential Live-Mutex implementation error => message did not contain uuid =>' + util.inspect(data))
        );
      }
      
      if (self.giveups[uuid]) {
        log.debug(chalk.red('we already gave up on this request:', data));
        delete self.giveups[uuid];
        return;
      }
      
      const fn = self.resolutions[uuid];
      const to = self.timeouts[uuid];
      
      if (fn && to) {
        this.emitter.emit('warning', new Error('Function and timeout both exist => Live-Mutex implementation error.'));
      }
      
      if (to) {
        
        this.emitter.emit('warning', new Error('Client side lock/unlock request timed-out.'));
        delete self.timeouts[uuid];
        if (data.type === 'lock') {
          self.write({uuid: uuid, key: data.key, type: 'lock-received-rejected'});
        }
        return;
      }
      
      if (fn) {
        clearTimeout(self.timers[uuid]);
        delete self.timeouts[uuid];
        fn.call(this, null, data);
        return;
      }
      
      this.emitter.emit('warning', new Error('Live-mutex implementation warning, ' +
        'no fn with that uuid in the resolutions hash => ' + util.inspect(data)));
      
      if (data.acquired === true && data.type === 'lock') {
        
        this.emitter.emit('warning', new Error('Rejecting lock acquisition.'));
        
        self.write({
          uuid: uuid,
          key: data.key,
          type: 'lock-received-rejected'
        });
      }
      
    };
    
    this.ensure = this.connect = (cb?: Function) => {
      
      if (cb && typeof cb !== 'function') {
        throw new Error('optional argument to ensure/connect must be a function.');
      }
      
      if (connectPromise && ws.writable && self.isOpen) {
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
        
        let onFirstErr = (e: any) => {
          let err = new Error('live-mutex client error => ' + (e && e.stack || e));
          this.emitter.emit('warning', err);
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
        
        ws.setEncoding('utf8')
        .once('end', () => {
          this.emitter.emit('warning', new Error('client stream "end" event occurred.'));
        })
        .once('error', onFirstErr)
        .once('close', () => {
          self.isOpen = false;
        })
        .on('error', (e) => {
          self.isOpen = false;
          this.emitter.emit('warning', new Error('live-mutex client error: ' + e.stack || util.inspect(e)));
        })
        .pipe(createParser())
        .on('data', onData)
        .once('error', function (e: any) {
          self.write({error: String(e && e.stack || e)}, function () {
            ws.end();
          });
        });
      })
      // if the user passes a callback, we fire the callback here
      .then(val => {
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
    this.timers = {};
    
    // if the user passes a callback, we call connect here
    // on behalf of the user
    cb && this.connect(cb);
    
  };
  
  static create(opts: Partial<ClientOpts>): Client {
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
        this.emitter.emit('warning', data.error);
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
  
  private fireUnlockCallbackWithError(err: any, uuid: string, cb: LMClientUnlockCallBack, key: string, to: Timer) {
    
    this.cleanUp(to, uuid);
    
    try {
      const v = this.lockQueues[key] && this.lockQueues[key].pop();
      v && this.lockInternal.apply(this, v);
    }
    catch (err) {
      this.emitter.emit('warning', err);
    }
    
    err = err instanceof Error ? err : new Error(err);
    this.emitter.emit('warning', err);
    cb(err, uuid);
  }
  
  private fireLockCallbackWithError(err: any, uuid: string, cb: LMClientLockCallBack, key: string, to: Timer) {
    
    this.cleanUp(to, uuid);
    
    try {
      const v = this.lockQueues[key] && this.lockQueues[key].pop();
      v && this.lockInternal.apply(this, v);
    }
    catch (err) {
      this.emitter.emit('warning', err);
    }
    
    err = err instanceof Error ? err : new Error(err);
    this.emitter.emit('warning', err);
    
    cb(err, {acquired: false, key, lockUuid: uuid, id: uuid});
    
  }
  
  ls(opts: any, cb?: ErrFirstDataCallback) {
    
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    
    if (typeof cb !== 'function') {
      throw new Error('Callback needs to be a function type.');
    }
    
    opts = opts || {};
    const id = uuidV4();
    
    this.resolutions[id] = cb;
    
    this.write({
      keepLocksAfterDeath: opts.keepLocksAfterDeath,
      uuid: id,
      type: 'ls',
    });
    
  }
  
  lock(key: string, opts: any, cb?: LMClientLockCallBack) {
    
    this.bookkeeping[key] = this.bookkeeping[key] || {
      rawLockCount: 0,
      rawUnlockCount: 0,
      lockCount: 0,
      unlockCount: 0
    };
    
    this.lockQueues[key] = this.lockQueues[key] || [];
    
    const rawLockCount = ++this.bookkeeping[key].rawLockCount;
    const unlockCount = this.bookkeeping[key].unlockCount;
    
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
    
    opts = opts || {} as Partial<ClientOpts>;
    
    cb = cb.bind(this);
    
    if (process.domain) {
      cb = process.domain.bind(cb);
    }
    
    try {
      
      assert.equal(typeof key, 'string', 'Key passed to live-mutex #lock needs to be a string.');
      assert(typeof cb === 'function', 'callback function must be passed to Client lock() method.');
      
      if ('append' in opts) {
        assert.equal(typeof opts.append, 'string', ' => Live-Mutex usage error => ' +
          '"append" option must be a string value.');
      }
      
      if (opts['force']) {
        assert.equal(typeof opts.force, 'boolean', ' => Live-Mutex usage error => ' +
          '"force" option must be a boolean value. Coerce it on your side, for safety.');
      }
      
      if (opts['maxRetries']) {
        assert(Number.isInteger(opts.maxRetries), '"retry" option must be an integer.');
        assert(opts.maxRetries >= 0 && opts.maxRetries <= 20,
          '"retry" option must be an integer between 0 and 20 inclusive.');
      }
      
      if (opts['maxRetry']) {
        assert(Number.isInteger(opts.maxRetry), '"retry" option must be an integer.');
        assert(opts.maxRetry >= 0 && opts.maxRetry <= 20,
          '"retry" option must be an integer between 0 and 20 inclusive.');
      }
      
      if (opts['ttl'] === Infinity) {
        // allow ttl to be stringified, null or Infinity both mean there is no ttl
        opts['ttl'] = null;
      }
      
      if (opts['ttl']) {
        assert(Number.isInteger(opts.ttl),
          ' => Live-Mutex usage error => Please pass an integer representing milliseconds as the value for "ttl".');
        assert(opts.ttl >= 3 && opts.ttl <= 800000,
          ' => Live-Mutex usage error => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
      }
      
      if (opts['lockRequestTimeout']) {
        assert(Number.isInteger(opts.lockRequestTimeout),
          ' => Please pass an integer representing milliseconds as the value for "ttl".');
        assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000,
          ' => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
      }
      
      opts.__retryCount = opts.__retryCount || 0;
      
      if (opts.__retryCount > 0) {
        assert(opts._uuid, 'Live-Mutex internal error: no _uuid past to retry call.');
      }
      
    }
    catch (err) {
      return process.nextTick(cb, err);
    }
    
    // if (rawLockCount - unlockCount > 5) {
    //   this.lockQueues[key].unshift([key, opts, cb]);
    // }
    // else {
    this.lockInternal.call(this, key, opts, cb);
    // }
    
  }
  
  private lockInternal(key: string, opts: any, cb: LMClientLockCallBack) {
    
    const uuid = opts._uuid = opts._uuid || uuidV4();
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
    
    const to = this.timers[uuid] = setTimeout(() => {
      
      timedOut = true;
      delete this.timers[uuid];
      delete self.resolutions[uuid];
      
      ++opts.__retryCount;
      
      this.emitter.emit('warning',
        `retrying lock request for key '${key}', on host:port '${self.getHost()}:${self.getPort()}', ` +
        `attempt # ${opts.__retryCount}` as any,
      );
      
      if (opts.__retryCount >= maxRetries) {
        this.timeouts[uuid] = true;
        self.write({uuid, key, type: 'lock-client-timeout'});
        return cb(new Error(`Live-Mutex client lock request timed out after ${lockTimeout * opts.__retryCount} ms, ` +
          `${maxRetries} retries attempted.`), {acquired: false, key, lockUuid: uuid, id: uuid});
      }
      
      self.lock(key, opts, cb);
      
    }, lockTimeout);
    
    this.resolutions[uuid] = (err, data) => {
      
      if (timedOut) {
        return;
      }
      
      if (err) {
        return this.fireLockCallbackWithError(err, uuid, cb, key, to);
      }
      
      if (!data) {
        return this.fireLockCallbackWithError('no data received from broker.', uuid, cb, key, to);
      }
      
      if (data.uuid !== uuid) {
        return this.fireLockCallbackWithError(
          `Live-Mutex error, mismatch in uuids -> '${data.uuid}', -> '${uuid}'.`,
          uuid, cb, key, to
        );
      }
      
      if (String(key) !== String(data.key)) {
        return this.fireLockCallbackWithError(
          `Live-Mutex bad key, [1] => '${key}', [2] -> ${data.key}`,
          uuid, cb, key, to
        );
      }
      
      if (data.error) {
        return this.fireLockCallbackWithError(data.error, uuid, cb, key, to);
      }
      
      if (data.acquired === true) {
        
        this.cleanUp(to, uuid);
        self.bookkeeping[key].lockCount++;
        log.debug('lock was received!');
        self.write({uuid: uuid, key: key, type: 'lock-received'});
        
        let boundUnlock = self.unlock.bind(self, key, {_uuid: uuid});
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
          
          cb(new Error('Could not acquire lock on first attempt and wait===false.'), {
            key,
            acquired: false,
            lockUuid: uuid,
            id: uuid
          });
        }
      }
      else {
        this.fireLockCallbackWithError(
          `Implementation error, please report, fallthrough in condition [1]`, uuid, cb, key, to
        );
      }
      
    };
    
    this.write({
      keepLocksAfterDeath: opts.keepLocksAfterDeath,
      retryCount: opts.__retryCount,
      uuid: uuid,
      key: key,
      type: 'lock',
      ttl: ttl
    });
    
  }
  
  noop() {
  
  }
  
  getPort() {
    return this.port;
  }
  
  getHost() {
    return this.host;
  }
  
  unlock(key: string, opts?: any, cb?: LMClientUnlockCallBack) {
    
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
    
    if (cb && cb !== this.noop) {
      cb = cb.bind(this);
      if (process.domain) {
        cb = process.domain.bind(cb);
      }
    }
    
    cb = cb || this.noop;
    
    try {
      assert.equal(typeof key, 'string', 'Key passed to live-mutex #unlock needs to be a string.');
      
      if (opts['force']) {
        assert.equal(typeof opts.force, 'boolean', ' => Live-Mutex usage error => ' +
          '"force" option must be a boolean value. Coerce it on your side, for safety.');
      }
      
      if (opts['unlockRequestTimeout']) {
        assert(Number.isInteger(opts.lockRequestTimeout),
          ' => Please pass an integer representing milliseconds as the value for "ttl".');
        assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000,
          ' => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
      }
    }
    catch (err) {
      return process.nextTick(cb, err);
    }
    
    const uuid = uuidV4();
    const unlockTimeout = opts.unlockRequestTimeout || this.unlockTimeout;
    
    let timedOut = false;
    
    const to = this.timers[uuid] = setTimeout(() => {
      
      timedOut = true;
      delete this.timers[uuid];
      delete this.resolutions[uuid];
      this.timeouts[uuid] = true;
      let err = new Error('Unlock request timed out.');
      this.emitter.emit('warning', err);
      cb(err);
      
      try {
        const v = this.lockQueues[key] && this.lockQueues[key].pop();
        v && this.lockInternal.apply(this, v);
      }
      catch (err) {
        this.emitter.emit('warning', err);
      }
      
    }, unlockTimeout);
    
    this.resolutions[uuid] = (err, data) => {
      
      const v = this.lockQueues[key] && this.lockQueues[key].pop();
      v && this.lockInternal.apply(this, v);
      
      if (timedOut) {
        return;
      }
      
      if (err) {
        return this.fireUnlockCallbackWithError(err, uuid, cb, key, to);
      }
      
      if (!data) {
        return this.fireUnlockCallbackWithError('Live-Mutex implementation error, bad key.',
          uuid, cb, key, to);
      }
      
      if (String(key) !== String(data.key)) {
        return this.fireUnlockCallbackWithError('Live-Mutex implementation error, bad key.',
          uuid, cb, key, to);
      }
      
      if (data.error) {
        return this.fireUnlockCallbackWithError(data.error, uuid, cb, key, to);
      }
      
      if (data.unlocked === true) {
        
        this.cleanUp(to, uuid);
        this.bookkeeping[key].unlockCount++;
        this.write({
          uuid: uuid,
          key: key,
          type: 'unlock-received'
        });
        
        cb(null, data.uuid);
      }
      else if (data.unlocked === false) {
        // data.error will most likely be defined as well
        // so this may never get hit
        this.cleanUp(to, uuid);
        cb(data);
      }
      else {
        this.fireUnlockCallbackWithError('fallthrough in conditional [2], Live-Mutex failure.',
          uuid, cb, key, to);
      }
      
    };
    
    let force: boolean = (opts.__retryCount > 0) || Boolean(opts.force);
    
    this.write({
      _uuid: opts._uuid,
      uuid: uuid,
      key: key,
      force: force,
      type: 'unlock'
    });
  }
  
}

// aliases
export default Client;
export const LMClient = Client;
export const LvMtxClient = Client;
