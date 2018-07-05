'use strict';

//core
import * as util from 'util';
import * as assert from 'assert';
import * as net from 'net';

//npm
import UUID = require('uuid');
import chalk from "chalk";
import {createParser} from "./json-parser";

//project
import {forDebugging} from './shared-internal';
const debugLog = process.argv.indexOf('--lmx-debug') > 0;

export const log = {
  info: console.log.bind(console, chalk.gray.bold('[lmx info]')),
  warn: console.error.bind(console, chalk.magenta.bold('[lmx warning]')),
  error: console.error.bind(console, chalk.red.bold('[lmx error]')),
  debug: function (...args: any[]) {
    if(debugLog){
      let newTime = Date.now();
      let elapsed = newTime - forDebugging.previousTime;
      forDebugging.previousTime = newTime;
      console.log(chalk.yellow.bold('[lmx client debugging]'), 'elapsed millis:', `(${elapsed})`, ...args);
    }
  }
};

/////////////////////////////////////////////////////////////////////////

import {weAreDebugging} from './we-are-debugging';
import Timer = NodeJS.Timer;
import {EventEmitter} from 'events';
import * as path from "path";
import {LMXLockRequestError, LMXUnlockRequestError} from "./shared-internal";
if (weAreDebugging) {
  log.debug('Live-Mutex client is in debug mode. Timeouts are turned off.');
}

/////////////////////////////////////////////////////////////////////////

export interface ValidConstructorOpts {
  [key: string]: string
}

export const validConstructorOptions = <ValidConstructorOpts>{
  key: 'string',
  listener: 'Function',
  host: 'string',
  port: 'integer',
  ttl: 'integer in millis',
  unlockRequestTimeout: 'integer in millis',
  lockRequestTimeout: 'integer in millis',
  lockRetryMax: 'integer',
  keepLocksAfterDeath: 'boolean',
  keepLocksOnExit: 'boolean',
  noDelay: 'boolean',
  udsPath: 'string (absolute file path)'
};

export const validLockOptions = {
  force: 'boolean',
  maxRetries: 'integer',
  maxRetry: 'integer',
  ttl: 'integer in millis',
  lockRequestTimeout: 'integer in millis',
  keepLocksAfterDeath: 'boolean',
  keepLocksOnExit: 'boolean'
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
  lockRetryMax: number;
  retryMax: number;
  maxRetries: number;
  ttl: number,
  keepLocksAfterDeath: boolean,
  keepLocksOnExit: boolean,
  noDelay: boolean;
  udsPath: string
}

export type EndReadCallback = (err?: any, val?: any) => void;

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

export interface LMLockSuccessData {
  acquired: boolean,
  key: string,
  unlock?: LMCallableLockSuccessData,
  lockUuid: string,
  readersCount: number,
  id: string
}

export interface LMUnlockSuccessData {
  unlocked: true,
  key: string,
  id: string
}

export interface LMCallableLockSuccessData extends LMLockSuccessData {
  (fn: EVCallback): void  // unlock convenience callback
}

export type EVCallback = (err?: any, val?: any) => void;

export interface LMClientLockCallBack {
  (err: LMXClientLockException, v?: LMCallableLockSuccessData): void;
}

export interface LMClientUnlockCallBack {
  (err: LMXClientUnlockException, v?: LMUnlockSuccessData): void
}

export class LMXClientLockException {

  code: LMXLockRequestError;
  message: string;
  key: string;
  id: string;
  stack: string;

  constructor(key: string, id: string, code: LMXLockRequestError, message: string) {
    this.id = id;
    this.key = key;
    this.code = code;

    if (typeof message !== 'string') {
      message = util.inspect(message, {breakLength: Infinity});
    }

    this.message = message;
    this.stack = message;
  }

}

export class LMXClientUnlockException {

  code: LMXUnlockRequestError;
  message: string;
  key: string;
  id: string;
  stack: string;

  constructor(key: string, id: string, code: LMXUnlockRequestError, message: string) {
    this.id = id;
    this.key = key;
    this.code = code;

    if (typeof message !== 'string') {
      message = util.inspect(message, {breakLength: Infinity});
    }

    this.message = message;
    this.stack = message;
  }

}

//////////////////////////////////////////////////////////////////////////////////////////

export class Client {

  port: number;
  host: string;
  listeners: Object;
  opts: Partial<ClientOpts>;
  ttl: number;
  unlockRequestTimeout: number;
  lockRequestTimeout: number;
  lockRetryMax: number;
  ws: net.Socket;
  timeouts: IUuidTimeoutBool;
  resolutions: IClientResolution;
  bookkeeping: IBookkeepingHash;
  ensure: Ensure;
  connect: Ensure;
  giveups: UuidBooleanHash;
  timers: { [key: string]: Timer };
  write: (data: any, cb?: Function) => void;
  isOpen: boolean;
  close: Function;
  lockQueues = {}  as { [key: string]: Array<any> };
  keepLocksAfterDeath = false;
  keepLocksOnExit = false;
  emitter = new EventEmitter();
  noDelay = true;
  socketFile = '';
  readerCounts = <{ [key: string]: number }>{};
  writeKeys = <{ [key: string]: true }>{}; // keeps track of whether a key has been registered as a write key

  ////////////////////////////////////////////////////////////////

  constructor(o?: Partial<ClientOpts>, cb?: LMClientCallBack) {

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

    if (opts['lockRetryMax']) {
      assert(Number.isInteger(opts.lockRetryMax),
        ' => "lockRetryMax" option needs to be an integer.');
      assert(opts.lockRetryMax >= 0 && opts.lockRetryMax <= 100,
        ' => "lockRetryMax" integer needs to be in range (0-100).');
    }

    if (opts['retryMax']) {
      assert(Number.isInteger(opts.retryMax),
        ' => "retryMax" option needs to be an integer.');
      assert(opts.retryMax >= 0 && opts.retryMax <= 100,
        ' => "retryMax" integer needs to be in range (0-100).');
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

    if ('keepLocksOnExit' in opts) {
      assert(typeof opts.keepLocksOnExit === 'boolean',
        ' => "keepLocksOnExit" option needs to be a boolean.');
    }

    if (opts.ttl === null) {
      opts.ttl = Infinity;
    }

    if ('noDelay' in opts && opts['noDelay'] !== undefined) {
      assert(typeof opts.noDelay === 'boolean',
        ' => "noDelay" option needs to be an integer => ' + opts.noDelay);
      this.noDelay = opts.noDelay;
    }

    if ('udsPath' in opts && opts['udsPath'] !== undefined) {
      assert(typeof opts.udsPath === 'string', '"udsPath" option must be a string.');
      assert(path.isAbsolute(opts.udsPath), '"udsPath" option must be an absolute path.');
      this.socketFile = path.resolve(opts.udsPath);
    }

    this.keepLocksAfterDeath = Boolean(opts.keepLocksAfterDeath || opts.keepLocksOnExit);
    this.listeners = {};
    this.host = opts.host || 'localhost';
    this.port = opts.port || 6970;
    this.ttl = weAreDebugging ? 5000000 : (opts.ttl || 7050);
    this.unlockRequestTimeout = weAreDebugging ? 5000000 : (opts.unlockRequestTimeout ||8000);
    this.lockRequestTimeout = weAreDebugging ? 5000000 : (opts.lockRequestTimeout || 3000);
    this.lockRetryMax = opts.lockRetryMax || opts.maxRetries || opts.retryMax || 3;

    let ws: net.Socket = null;
    let connectPromise: Promise<any> = null;

    this.emitter.on('warning', () => {
      if (this.emitter.listenerCount('warning') < 2) {
        process.emit.call(process, 'warning', ...Array.from(arguments)
        .map(v => (typeof v === 'string' ? v : util.inspect(v))));
        process.emit.call(process, 'warning',
          'Add a "warning" event listener to the Live-Mutex client to get rid of this message.');
      }
    });

    const self = this;

    this.write = (data: any, cb?: Function) => {

      if (!ws) {
        throw new Error('please call ensure()/connect() on this Live-Mutex client, before using the lock/unlock methods.');
      }

      data.max = data.max || null;
      data.pid = process.pid;

      if (data.ttl === Infinity) {
        data.ttl = null;
      }

      if ('keepLocksAfterDeath' in data) {
        data.keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
      }
      else {
        data.keepLocksAfterDeath = this.keepLocksAfterDeath || false;
      }

      ws.write(JSON.stringify(data) + '\n', 'utf8', cb);
    };

    const onData = (data: any) => {

      const uuid = data.uuid;
      const _uuid = data._uuid;

      if (!(data && typeof data === 'object')) {
        return this.emitter.emit('error', 'Internal error -> data was not an object.');
      }

      if (data.error) {
        this.emitter.emit('error', data.error);
      }

      if (data.warning) {
        this.emitter.emit('warning', data.warning);
      }

      if (!uuid) {
        return this.emitter.emit('warning',
          'Potential Live-Mutex implementation error => message did not contain uuid =>' + util.inspect(data)
        );
      }

      if (self.giveups[uuid]) {
        delete self.giveups[uuid];
        return;
      }

      const fn = self.resolutions[uuid];
      const to = self.timeouts[uuid];

      if (fn && to) {
        this.emitter.emit('warning', 'Function and timeout both exist => Live-Mutex implementation error.');
      }

      if (to) {
        this.emitter.emit('warning', 'Client side lock/unlock request timed-out.');
        delete self.timeouts[uuid];
        if (data.acquired === true && data.type === 'lock') {
          self.write({uuid: uuid, _uuid, key: data.key, type: 'lock-received-rejected'});
        }
        return;
      }

      if (fn) {
        // fn.call(this, null, data);
        fn.call(this, data.error, data);
        return;
      }

      this.emitter.emit('warning', 'Live-mutex implementation warning, ' +
        'no fn with that uuid in the resolutions hash => ' + util.inspect(data, {breakLength: Infinity}));

      if (data.acquired === true && data.type === 'lock') {

        this.emitter.emit('warning', `Rejecting lock acquisition for key => "${data.key}".`);

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
        ws.destroy((err: any) => err && log.error(err.message || err));
      }

      return connectPromise = new Promise((resolve, reject) => {

        let onFirstErr = (e: any) => {
          let err = '[lmx] client error => ' + (e && e.message || e);
          this.emitter.emit('warning', err);
          reject(err);
        };

        let to = setTimeout(function () {
          reject('[lmx] err: client connection timeout after 2000ms.');
        }, 3000);

        let cnkt: any = self.socketFile || {port: self.port};

        ws = net.createConnection(cnkt, () => {
          self.isOpen = true;
          clearTimeout(to);
          ws.removeListener('error', onFirstErr);
          resolve(this);
        });

        if (self.noDelay) {
          ws.setNoDelay(true);
        }

        ws.setEncoding('utf8')
        .once('end', () => {
          this.emitter.emit('warning', '[lmx] => client stream "end" event occurred.');
        })
        .once('error', onFirstErr)
        .once('close', () => {
          self.isOpen = false;
        })
        .on('error', (e) => {
          self.isOpen = false;
          this.emitter.emit('warning', '[lmx] client error => ' + e.message || util.inspect(e));
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

    assert.equal(typeof key, 'string', 'Key passed to lmx#lock needs to be a string.');

    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }

    opts = opts || {};
    const uuid = opts._uuid || UUID.v4();

    this.resolutions[uuid] = (err, data) => {

      clearTimeout(this.timers[uuid]);
      delete this.timeouts[uuid];

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
        cb(null, {data});
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

  unlockp(key: string, opts?: Partial<LMClientUnlockOpts>): Promise<string> {
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

  run(fn: EVCallback) {
    return new Promise((resolve, reject) => {
      fn((err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }

  runUnlock(fn: LMCallableLockSuccessData): Promise<any> {
    return this.run.apply(this, arguments);
  }

  execUnlock(fn: LMCallableLockSuccessData): Promise<any> {
    return this.run.apply(this, arguments);
  }

  protected cleanUp(uuid: string) {
    clearTimeout(this.timers[uuid]);
    delete this.timers[uuid];
    delete this.timeouts[uuid];
    delete this.resolutions[uuid];
  }

  protected fireUnlockCallbackWithError(cb: LMClientUnlockCallBack, err: LMXClientUnlockException) {

    const uuid = err.id;
    const key = err.key;

    this.cleanUp(uuid);

    try {
      const v = this.lockQueues[key] && this.lockQueues[key].pop();
      v && this.lockInternal.apply(this, v);
    }
    catch (err) {
      this.emitter.emit('warning', err);
    }

    this.emitter.emit('warning', err.message);
    cb(err);
  }

  protected fireLockCallbackWithError(cb: LMClientLockCallBack, err: LMXClientLockException) {

    const uuid = err.id;
    const key = err.key;

    this.cleanUp(uuid);

    try {
      const v = this.lockQueues[key] && this.lockQueues[key].pop();
      v && this.lockInternal.apply(this, v);
    }
    catch (err) {
      this.emitter.emit('warning', err.message);
    }

    this.emitter.emit('warning', err.message);
    cb(err);
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
    const id = UUID.v4();

    this.resolutions[id] = cb;

    this.write({
      keepLocksAfterDeath: opts.keepLocksAfterDeath,
      uuid: id,
      type: 'ls',
    });

  }

  parseLockOpts(key: string, opts: any, cb?: any): [string, any, LMClientLockCallBack] {

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

    assert(typeof cb === 'function', 'Please use a callback as the last argument to the lock method.');
    opts = opts || {} as Partial<ClientOpts>;
    return [key, opts, cb];

  }

  parseUnlockOpts(key: string, opts?: any, cb?: any): [string, any, LMClientUnlockCallBack] {

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
    assert(typeof cb === 'function', 'Please use a callback as the last argument to the unlock method.');
    return [key, opts, cb];
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

    try {
      [key, opts, cb] = this.parseLockOpts(key, opts, cb);
    }
    catch (err) {
      if (typeof cb === 'function') {
        return process.nextTick(cb, err);
      }
      throw err;
    }

    try {

      assert.equal(typeof key, 'string', 'Key passed to live-mutex #lock needs to be a string.');
      assert(typeof cb === 'function', 'callback function must be passed to Client lock() method; use lockp() or acquire() for promise API.');

      if ('max' in opts) {
        assert(Number.isInteger(opts['max']), '"max" options property must be a positive integer.');
        assert(opts['max'] > 0, '"max" options property must be a positive integer.');
      }

      if ('semaphore' in opts) {
        assert(Number.isInteger(opts['semaphore']), '"semaphore" options property must be a positive integer.');
        assert(opts['semaphore'] > 0, '"semaphore" options property must be a positive integer.');
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

      if (opts['retryMax']) {
        assert(Number.isInteger(opts.retryMax), '"retry" option must be an integer.');
        assert(opts.retryMax >= 0 && opts.retryMax <= 20,
          '"retry" option must be an integer between 0 and 20 inclusive.');
      }

      if (opts['ttl']) {
        assert(Number.isInteger(opts.ttl),
          ' => Live-Mutex usage error => Please pass an integer representing milliseconds as the value for "ttl".');
        assert(opts.ttl >= 3 && opts.ttl <= 800000,
          ' => Live-Mutex usage error => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
      }

      if (opts['ttl'] === null) {
        // allow ttl to be stringified, null or Infinity both mean there is no ttl
        opts['ttl'] = Infinity;
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

      if (typeof cb === 'function') {
        cb = cb.bind(this);
        return process.nextTick(cb, err);
      }

      throw err;
    }

    cb = cb.bind(this);

    if (process.domain) {
      cb = process.domain.bind(cb);
    }

    // if (rawLockCount - unlockCount > 5) {
    //   this.lockQueues[key].unshift([key, opts, cb]);
    // }
    // else {
    this.lockInternal(key, opts, cb);
    // }

  }

  on() {
    log.warn('warning:', 'use c.emitter.on() instead of c.on()');
    return this.emitter.on.apply(this.emitter, arguments);
  }

  once() {
    log.warn('warning:', 'use c.emitter.once() instead of c.once()');
    return this.emitter.once.apply(this.emitter, arguments);
  }

  private lockInternal(key: string, opts: any, cb: LMClientLockCallBack) {

    const uuid = opts._uuid = opts._uuid || UUID.v4();
    const ttl = opts.ttl || this.ttl;
    const lrt = opts.lockRequestTimeout || this.lockRequestTimeout;
    const maxRetries = opts.maxRetry || opts.maxRetries || this.lockRetryMax;
    const retryCount = opts.__retryCount;
    const forceUnlock = opts.forceUnlock === true;
    const noRetry = opts.retry === false;

    if (retryCount > maxRetries) {
      return cb(new LMXClientLockException(
        key,
        uuid,
        LMXLockRequestError.MaxRetries,
        `Maximum retries (${maxRetries}) attempted to acquire lock for key "${key}".`
      ));
    }

    const rwStatus = opts.rwStatus || null;
    const max = opts.max;
    const self = this;
    let timedOut = false;

    this.timers[uuid] = setTimeout(() => {

      timedOut = true;
      delete this.timers[uuid];
      delete self.resolutions[uuid];

      const currentRetryCount = opts.__retryCount;
      const newRetryCount = ++opts.__retryCount;

       // noRetry
      if (newRetryCount >= maxRetries) {

        try {
          const v = this.lockQueues[key] && this.lockQueues[key].pop();
          v && this.lockInternal.apply(this, v);
        }
        catch (err) {
          this.emitter.emit('warning', err);
        }

        this.timeouts[uuid] = true;
        self.write({uuid, key, type: 'lock-client-timeout'});

        return cb(new LMXClientLockException(
          key,
          uuid,
          LMXLockRequestError.RequestTimeoutError,
          `Live-Mutex client lock request timed out after ${lrt * opts.__retryCount} ms, ` +
          `${currentRetryCount} retries attempted to acquire lock for key "${key}".`
        ));
      }

      this.emitter.emit('warning',
        `retrying lock request for key '${key}', on host:port '${self.getHost()}:${self.getPort()}', ` +
        `retry attempt # ${newRetryCount}`,
      );

      // this has to be called synchronously,
      // so we can get a new resolution callback on the books
      self.lockInternal(key, opts, cb);

    }, lrt);

    this.resolutions[uuid] = (err, data) => {

      try {
        const v = this.lockQueues[key] && this.lockQueues[key].pop();
        v && this.lockInternal.apply(this, v);
      }
      catch (err) {
        this.emitter.emit('warning', err);
      }

      if (timedOut) {
        return;
      }

      if (err) {
        return this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          uuid,
          LMXLockRequestError.UnknownException,
          'Unknown lmx client exception: ' + util.inspect(err)
        ));
      }

      if (!data) {
        return this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          uuid,
          LMXLockRequestError.InternalError,
          'LMX inernal error: no data received from broker in client lock resolution callback.'
        ));
      }

      if (data.uuid !== uuid) {
        return this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          uuid,
          LMXLockRequestError.InternalError,
          `Internal Live-Mutex error, mismatch in uuids => '${data.uuid}', -> '${uuid}'.`
        ));
      }

      if (String(key) !== String(data.key)) {
        return this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          uuid,
          LMXLockRequestError.InternalError,
          `Live-Mutex internal error: bad key, [1] => '${key}', [2] => '${data.key}'.`
        ));
      }

      if (data.error) {
        return this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          uuid,
          LMXLockRequestError.GenericLockError,
          data.error,
        ));
      }

      if (data.acquired === true) {
        // lock was acquired for the given key, yippee
        this.cleanUp(uuid);
        self.bookkeeping[key].lockCount++;
        self.write({uuid, key, type: 'lock-received'}); // we let the broker know that we received the lock
        const boundUnlock = self.unlock.bind(self, key, {_uuid: uuid, rwStatus, force: forceUnlock});
        boundUnlock.acquired = true;
        boundUnlock.readersCount = Number.isInteger(data.readersCount) ? data.readersCount : null;
        boundUnlock.key = key;
        boundUnlock.unlock = boundUnlock.release = boundUnlock;
        boundUnlock.lockUuid = uuid;
        return cb(null, boundUnlock);
      }

      if (data.reelection === true) {
        this.cleanUp(uuid);
        return self.lockInternal(key, opts, cb);
      }

      if (data.acquired === false) {

        // if acquired is false, we will:
        // 1. be waiting for acquired to be true
        // 2. if the timeout occurs before 1, we will make a new request and put our request at the front of the queue
        // however, if wait is false, we will do neither 1 or 2

        if (opts.wait === false) {

          // when wait is false, user only wants to try once,
          // and doesn't even want to wait until the timeout elapses.
          // such that even if wait === false and maxRetries === 1,
          // we still wouldn't wait for the timeout to elapse

          self.giveups[uuid] = true;

          this.fireLockCallbackWithError(cb, new LMXClientLockException(
            key,
            uuid,
            LMXLockRequestError.WaitOptionSetToFalse,
            'Could not acquire lock on first attempt, and "wait" option is false.'
          ));

        }

        return;
      }


      this.fireLockCallbackWithError(cb, new LMXClientLockException(
        key,
        uuid,
        LMXLockRequestError.InternalError,
        `Implementation error, please report, fallthrough in condition [1]`
      ));

    };

    {

      let keepLocksAfterDeath = Boolean(opts.keepLocksAfterDeath || opts.keepLocksOnExit);

      this.write({
        keepLocksAfterDeath,
        retryCount,
        uuid: uuid,
        key: key,
        type: 'lock',
        ttl: ttl,
        rwStatus,
        max
      });
    }

  }

  noop() {
    // this is a no-operation, obviously
  }

  getPort() {
    return this.port;
  }

  getHost() {
    return this.host;
  }

  unlock(key: string, opts: any, cb?: LMClientUnlockCallBack) {

    this.bookkeeping[key] = this.bookkeeping[key] || {
      rawLockCount: 0,
      rawUnlockCount: 0,
      lockCount: 0,
      unlockCount: 0
    };

    this.bookkeeping[key].rawUnlockCount++;

    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    }
    catch (err) {
      if (typeof cb === 'function') {
        return process.nextTick(cb, err);
      }
      throw err;
    }

    if (opts.id) {
      opts._uuid = opts.id;
    }

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

    const uuid = UUID.v4();
    const rwStatus = opts.rwStatus || null;
    const urt = opts.unlockRequestTimeout || this.unlockRequestTimeout;

    let timedOut = false;

    this.timers[uuid] = setTimeout(() => {

      timedOut = true;
      this.timeouts[uuid] = true;

      try {
        const v = this.lockQueues[key] && this.lockQueues[key].pop();
        v && this.lockInternal.apply(this, v);
      }
      catch (err) {
        this.emitter.emit('warning', err);
      }

      this.fireUnlockCallbackWithError(cb, new LMXClientUnlockException(
        key, uuid,
        LMXUnlockRequestError.BadOrMismatchedId,
        ` [lmx] Unlock request to unlock key => "${key}" timed out.`
      ));

    }, urt);

    this.resolutions[uuid] = (err, data) => {

      delete this.timeouts[uuid];
      clearTimeout(this.timers[uuid]);

      try {
        const v = this.lockQueues[key] && this.lockQueues[key].pop();
        v && this.lockInternal.apply(this, v);
      }
      catch (err) {
        this.emitter.emit('warning', err.message);
      }

      if (timedOut) {
        return;
      }

      if (err) {
        return this.fireUnlockCallbackWithError(cb, new LMXClientUnlockException(
          key,
          uuid,
          LMXUnlockRequestError.InternalError,
          'LMX unknown/internal error: ' + util.inspect(err, {breakLength: Infinity})
        ));
      }

      if (!data) {
        return this.fireUnlockCallbackWithError(cb, new LMXClientUnlockException(
          key,
          uuid,
          LMXUnlockRequestError.InternalError,
          `Live-Mutex internal error: missing data in unlock resolution.`,
        ));
      }

      if (String(key) !== String(data.key)) {
        return this.fireUnlockCallbackWithError(cb, new LMXClientUnlockException(
          key,
          uuid,
          LMXUnlockRequestError.InternalError,
          `Live-Mutex implementation error, bad key => first key: ${key}, second key: ${data.key}`,
        ));
      }

      if (data.error) {
        return this.fireUnlockCallbackWithError(cb, new LMXClientUnlockException(
          key,
          uuid,
          LMXUnlockRequestError.GeneralUnlockError,
          'LMX request error: ' + data.error
        ));
      }

      if (data.unlocked === true) {

        this.cleanUp(uuid);
        this.bookkeeping[key].unlockCount++;
        this.write({
          uuid: uuid,
          key: key,
          type: 'unlock-received'
        });

        return cb(null, {id: uuid, key, unlocked: true});
      }

      if (data.unlocked === false) {
        // data.error will most likely be defined as well
        // so this may never get hit

        return this.fireUnlockCallbackWithError(cb, new LMXClientUnlockException(
          key,
          uuid,
          LMXUnlockRequestError.GeneralUnlockError,
          data
        ));
      }

      this.fireUnlockCallbackWithError(cb, new LMXClientUnlockException(
        key,
        uuid,
        LMXUnlockRequestError.GeneralUnlockError,
        'Internal error: fallthrough in unlock resolution routine.'
      ));

    };

    let force: boolean = (opts.__retryCount > 0) || Boolean(opts.force);

    this.write({
      _uuid: opts._uuid || opts.id || opts.lockUuid,
      uuid: uuid,
      key: key,
      rwStatus,
      force: force,
      type: 'unlock'
    });
  }

}

// aliases
export default Client;
export const LMXClient = Client;
export const LvMtxClient = Client;
