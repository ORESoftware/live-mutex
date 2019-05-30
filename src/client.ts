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
const clientPackage = require('../package.json');

if (!(clientPackage.version && typeof clientPackage.version === 'string')) {
  throw new Error('Client NPM package did not have a top-level field that is a string.');
}

export const log = {
  info: console.log.bind(console, chalk.gray.bold('lmx info:')),
  warn: console.error.bind(console, chalk.magenta.bold('lmx warning:')),
  error: console.error.bind(console, chalk.red.bold('lmx error:')),
  debug: function (...args: any[]) {
    if (debugLog) {
      let newTime = Date.now();
      let elapsed = newTime - forDebugging.previousTime;
      forDebugging.previousTime = newTime;
      console.log(chalk.yellow.bold('lmx client debugging:'), 'elapsed millis:', `(${elapsed})`, ...args);
    }
  }
};

/////////////////////////////////////////////////////////////////////////

import {weAreDebugging} from './we-are-debugging';
import Timer = NodeJS.Timer;
import {EventEmitter} from 'events';
import * as path from "path";
import {LMXLockRequestError, LMXUnlockRequestError} from "./shared-internal";
import {LMXClientLockException, LMXClientUnlockException} from "./exceptions";
import {compareVersions} from "./compare-versions";
import {EVCb} from "./utils";
import {LMXClientException} from "./exceptions";
import {LMXClientError} from "./shared-internal";

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


export interface IClientResolution {
  [key: string]: EVCb<any>
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

export interface LMXClientLockOpts {

}

export interface LMXClientUnlockOpts {

}

export interface LMLockSuccessData {
  (fn?: EVCallback): void
  
  acquired: true,
  key: string,
  unlock: LMLockSuccessData,
  lockUuid: string,
  readersCount: number,
  id: string
}

export interface LMUnlockSuccessData {
  unlocked: true,
  key: string,
  id: string
}

export type EVCallback = (err?: any, val?: any) => void;

export interface LMClientLockCallBack {
  (err: LMXClientLockException, v?: LMLockSuccessData): void;
}

export interface LMClientUnlockCallBack {
  (err: LMXClientUnlockException, v?: LMUnlockSuccessData): void
}

//////////////////////////////////////////////////////////////////////////////////////////

export class Client {
  
  port: number;
  host: string;
  listeners: Object;
  opts: Partial<ClientOpts>;
  ttl: number;
  noRecover: boolean;
  unlockRequestTimeout: number;
  lockRequestTimeout: number;
  lockRetryMax: number;
  ws: net.Socket;
  cannotContinue = false;
  timeouts: IUuidTimeoutBool;
  resolutions: IClientResolution;
  bookkeeping: IBookkeepingHash;
  ensure: Ensure;
  connect: Ensure;
  giveups: UuidBooleanHash;
  timers: { [key: string]: Timer };
  write: (data: any, cb?: EVCb<any>) => void;
  isOpen: boolean;
  close: () => void;
  keepLocksAfterDeath = false;
  keepLocksOnExit = false;
  createNewConnection: () => void;
  endCurrentConnection: () => void;
  emitter = new EventEmitter();
  noDelay = true;
  socketFile = '';
  recovering = false;
  readerCounts = <{ [key: string]: number }>{};
  writeKeys = <{ [key: string]: true }>{}; // keeps track of whether a key has been registered as a write key
  
  ////////////////////////////////////////////////////////////////
  
  constructor(o?: Partial<ClientOpts>, cb?: LMClientCallBack) {
    
    this.isOpen = false;
    const opts = this.opts = o || {};
    assert(typeof opts === 'object', 'Bad arguments to live-mutex client constructor - options must be an object.');
    
    if (cb) {
      assert(typeof cb === 'function', 'optional second argument to Live-Mutex Client constructor must be a function.');
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
    this.unlockRequestTimeout = weAreDebugging ? 5000000 : (opts.unlockRequestTimeout || 8000);
    this.lockRequestTimeout = weAreDebugging ? 5000000 : (opts.lockRequestTimeout || 3000);
    this.lockRetryMax = opts.lockRetryMax || opts.maxRetries || opts.retryMax || 3;
    
    let ws: net.Socket = null;
    let connectPromise: Promise<any> = null;
    
    const self = this;
    
    this.emitter.on('warning', function () {
      if (self.emitter.listenerCount('warning') < 2) {
        log.warn('No "warning" event handler(s) attached by end-user to client.emitter, therefore logging these errors from LMX library:');
        log.warn(...Array.from(arguments).map(v => (typeof v === 'string' ? v : util.inspect(v))));
        log.warn('Add a "warning" event listener to the Live-Mutex client to get rid of this message.');
      }
    });
    
    this.write = (data: any, cb?: EVCb<any>) => {
      
      if (!ws) {
        throw new Error('please call ensure()/connect() on this Live-Mutex client, before using the lock/unlock methods.');
      }
      
      if (!ws.writable) {
        return this.ensure((err, val) => {
          if (err) {
            throw new Error('Could not reconnect.');
          }
          this.write(data, cb);
        });
      }
      
      data.max = data.max || null;
      data.pid = process.pid;
      
      if (data.ttl === Infinity) {
        data.ttl = null;
      }
      
      if ('keepLocksAfterDeath' in data) {
        data.keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
      } else {
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
      
      
      if (data.type === 'version-mismatch') {
        this.emitter.emit('error', data);
        log.error(data);
        this.cannotContinue = true;
        this.write({type: 'version-mismatch-confirmed'});
        this._fireCallbacksPrematurely(new Error('Version-match => ' + util.inspect(data)));
        return;
      }
      
      
      if (!uuid) {
        return this.emitter.emit('warning',
          'Potential Live-Mutex implementation error => message did not contain uuid =>' + util.inspect(data)
        );
      }
      
      const fn = this.resolutions[uuid];
      const to = this.timeouts[uuid];
      
      delete this.timeouts[uuid];
      // delete self.resolutions[uuid]; // don't do this here, the same resolution fn might need to be called more than once
      
      if (this.giveups[uuid]) {
        clearTimeout(this.timers[uuid]);
        delete this.giveups[uuid];
        delete this.resolutions[uuid];
        return;
      }
      
      if (fn && to) {
        this.emitter.emit('error', 'Function and timeout both exist => Live-Mutex implementation error.');
      }
      
      if (to) {
        this.emitter.emit('warning', 'Client side lock/unlock request timed-out.');
        if (data.acquired === true && data.type === 'lock') {
          self.write({uuid: uuid, _uuid, key: data.key, type: 'lock-received-rejected'});
        }
        return;
      }
      
      if (fn) {
        fn.call(this, data.error, data);
        return;
      }
      
      this.emitter.emit('warning', 'Live-mutex implementation warning, ' +
        'no fn with that uuid in the resolutions hash => ' + util.inspect(data, {breakLength: Infinity}));
      
      if (data.acquired === true && data.type === 'lock') {
        
        this.emitter.emit('warning', `Rejecting lock acquisition for key => "${data.key}".`);
        
        this.write({
          uuid: uuid,
          key: data.key,
          type: 'lock-received-rejected'
        });
      }
      
    };
    
    this.ensure = this.connect = (cb?: (err: any, v?: Client) => void) => {
      
      if (cb) {
        assert(typeof cb === 'function', 'Optional argument to ensure/connect must be a function.');
        if (process.domain) {
          cb = process.domain.bind(cb);
        }
      }
      
      if (!this.recovering && (connectPromise && ws && ws.writable && self.isOpen)) {
        return connectPromise.then((val) => {
            cb && cb.call(self, null, val);
            return val;
          },
          function (err) {
            cb && cb.call(self, err);
            return Promise.reject(err);
          });
      }
      
      this.recovering = false;
      
      if (ws) {
        ws.destroy();
        ws.removeAllListeners();
      }
      
      return connectPromise = new Promise((resolve, reject) => {
        
        const onFirstErr = (e: any) => {
          let err = 'LMX client error => ' + (e && e.message || e);
          this.emitter.emit('warning', err);
          reject(err);
        };
        
        const to = setTimeout(function () {
          reject('LMX err: client connection timeout after 3000ms.');
        }, 3000);
        
        const cnkt: Array<any> = self.socketFile ? [self.socketFile] : [self.port, self.host];
        
        // @ts-ignore
        ws = net.createConnection(...cnkt, () => {
          self.isOpen = true;
          clearTimeout(to);
          ws.removeListener('error', onFirstErr);
          this.write({type: 'version', value: clientPackage.version});
          resolve(this);
        });
        
        if (self.noDelay) {
          ws.setNoDelay(true);
        }
        
        let called = false;
        
        const recover = (e: any) => {
          
          console.error('RECOVERY HAPPENED.');
          console.error('RECOVERY HAPPENED.');
          console.error('RECOVERY HAPPENED.');
          console.error('RECOVERY HAPPENED.');
  
          
          if (called) {
            return;
          }
          
          called = true;
          
          if (this.noRecover) {
            return;
          }
          
          this.recovering = true;
          e && this.emitter.emit('warning', 'LMX client error => ' + e.message || util.inspect(e));
          
          if (!ws.destroyed) {
            ws.destroy();
            ws.removeAllListeners();
          }
          
          for (let resol of Object.entries(this.resolutions)) {
            this.giveups[resol[0]] = true;
            clearTimeout(this.timers[resol[0]]);
            resol[1]('Error: Connection ended/closed. ' +
              'A new connection will be created but all locking requests in-flight should get receive errors in the callbacks.', {});
          }
          
          this.ensure(); // create new connection
        };
        
        
        ws.setEncoding('utf8')
          
          .once('error', onFirstErr)
          .once('close', () => {
            this.emitter.emit('warning', 'LMX => client stream "close" event occurred.');
            recover(null);
          })
          .once('end', () => {
            this.emitter.emit('warning', 'LMX => client stream "end" event occurred.');
            recover(null);
          })
          .on('error', (e: any) => {
            this.emitter.emit('warning', 'LMX => client stream "error" event occurred.');
            recover(e);
          })
          .pipe(createParser())
          .on('data', onData)
        
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
      ws && ws.destroy();
    });
  
  
    this.endCurrentConnection = () => {
      return ws && ws.end();
    };
    
    this.close = () => {
      this.noRecover = true;
      return ws && ws.destroy();
    };
    
    this.createNewConnection = () => {
      return ws && ws.destroy();
    };
    
    this.timeouts = {};
    this.resolutions = {};
    this.giveups = {};
    this.timers = {};
    
    // if the user passes a callback, we call connect here
    // on behalf of the user
    cb && this.connect(cb);
    
  };
  
  onSocketDestroy(err: any) {
    console.log('Socket destroy callback error:', err);
  }
  
  
  
  static create(opts?: Partial<ClientOpts>): Client {
    return new Client(opts);
  }
  
  private _fireCallbacksPrematurely(err: any) {
    
    for (let k of Object.keys(this.timers)) {
      clearTimeout(this.timers[k]);
    }
    
    this.timers = {};
    err = err || new Error('Unknown error - firing resolution callbacks prematurely.');
    
    for (let k of Object.keys(this.resolutions)) {
      
      const fn = this.resolutions[k];
      delete this.resolutions[k];
      
      const e = {
        forcePrematureCallback: true,
        message: err.message,
        stack: err.stack,
      };
      
      fn.call(this, e, e);
    }
    
  }
  
  setNoRecover() {
    this.noRecover = true;
  }
  
  requestLockInfo(key: string, opts?: any, cb?: EVCb<any>) {
    
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
      
      if (err) {
        return this.fireCallbackWithError(cb, new LMXClientException(
          key,
          null,
          LMXClientError.UnknownError,
          err,
          `Unknown error - see included "originalError" object.)`
        ));
      }
      
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
  
  lockp(key: string, opts?: Partial<LMXClientLockOpts>): Promise<LMLockSuccessData> {
    return new Promise((resolve, reject) => {
      this.lock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }
  
  unlockp(key: string, opts?: Partial<LMXClientUnlockOpts>): Promise<LMUnlockSuccessData> {
    return new Promise((resolve, reject) => {
      this.unlock(key, opts, (err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }
  
  acquire(key: string, opts?: Partial<LMXClientLockOpts>) {
    return this.lockp.apply(this, arguments);
  }
  
  release(key: string, opts?: Partial<LMXClientUnlockOpts>) {
    return this.unlockp.apply(this, arguments);
  }
  
  acquireLock(key: string, opts?: Partial<LMXClientLockOpts>) {
    return this.lockp.apply(this, arguments);
  }
  
  releaseLock(key: string, opts?: Partial<LMXClientUnlockOpts>) {
    return this.unlockp.apply(this, arguments);
  }
  
  run(fn: LMLockSuccessData) {
    return new Promise((resolve, reject) => {
      fn((err, val) => {
        err ? reject(err) : resolve(val);
      });
    });
  }
  
  runUnlock(fn: LMLockSuccessData): Promise<any> {
    return this.run.apply(this, arguments);
  }
  
  execUnlock(fn: LMLockSuccessData): Promise<any> {
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
    const key = err.key; // unused
    this.cleanUp(uuid);
    this.emitter.emit('warning', err.message);
    cb(err, <LMUnlockSuccessData>{}); // need to pass empty object in case the user uses an object destructure call
  }
  
  protected fireLockCallbackWithError(cb: LMClientLockCallBack, err: LMXClientLockException) {
    const uuid = err.id;
    const key = err.key;  // unused
    this.cleanUp(uuid);
    this.emitter.emit('warning', err.message);
    cb(err, <LMLockSuccessData>{}); // need to pass empty object in case the user uses an object destructure call
  }
  
  protected fireCallbackWithError(cb: EVCb<any>, err: LMXClientException) {
    const uuid = err.id;
    const key = err.key;  // unused
    this.cleanUp(uuid);
    this.emitter.emit('warning', err.message);
    cb(err, <any>{}); // need to pass empty object in case the user uses an object destructure call
  }
  
  
  ls(cb: EVCb<any>): void;
  ls(opts: any, cb?: EVCb<any>): void;
  
  ls(opts: any, cb?: EVCb<any>) {
    
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
    } else if (typeof opts === 'boolean') {
      opts = {force: opts};
    } else if (typeof opts === 'number') {
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
    } else if (typeof opts === 'boolean') {
      opts = {force: opts};
    } else if (typeof opts === 'string') {
      opts = {_uuid: opts};
    }
    
    opts = opts || {};
    
    if(cb){
      assert(typeof cb === 'function', 'Please use a callback as the last argument to the unlock method.');
    }
    else{
      cb = this.noop;
    }
   
    return [key, opts, cb];
  }
  
  _simulateVersionMismatch() {
    this.write({
      type: 'simulate-version-mismatch',
    });
  }
  
  _invokeBrokerSideEndCall() {
    this.write({
      type: 'end-connection-from-broker-for-testing-purposes'
    });
  }
  
  _invokeBrokerSideDestroyCall() {
    this.write({
      type: 'destroy-connection-from-broker-for-testing-purposes'
    });
  }
  
  _makeClientSideError() {
    this.close();
  }
  
  // lock(key: string, cb: LMClientLockCallBack, z?: LMClientLockCallBack) : void;
  
  lock(key: string, cb: LMClientLockCallBack): void;
  lock(key: string, opts: any, cb: LMClientLockCallBack): void;
  
  lock(key: string, opts: any, cb?: LMClientLockCallBack): void {
    
    try {
      [key, opts, cb] = this.parseLockOpts(key, opts, cb);
    } catch (err) {
      if (typeof cb === 'function') {
        return process.nextTick(cb, err, {});
      }
      log.error('No callback was passed to accept the following error.',
        'Please include a callback as the final argument to the client.lock() routine.');
      throw err;
    }
    
    
    if (!this.isOpen) {
      return process.nextTick(() => {
        this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          null,
          LMXLockRequestError.ConnectionClosed,
          `Connection was closed (and/or a client connection error occurred.)`
        ));
      });
    }
    
    if (this.cannotContinue) {
      return process.nextTick(() => {
        this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          null,
          LMXLockRequestError.CannotContinue,
          `'Client cannot make any lock requests, most likely due to version mismatch between client and broker.'`
        ));
      });
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
      
      if ('force' in opts) {
        assert.equal(typeof opts.force, 'boolean', ' => Live-Mutex usage error => ' +
          '"force" option must be a boolean value. Coerce it on your side, for safety.');
      }
      
      if ('retry' in opts) {
        assert.equal(typeof opts.force, 'boolean', ' => Live-Mutex usage error => ' +
          '"retry" option must be a boolean value. Coerce it on your side, for safety.');
        opts.__maxRetries = 0;
      }
      
      if ('maxRetries' in opts) {
        assert(Number.isInteger(opts.maxRetries), '"maxRetries" option must be an integer.');
        assert(opts.maxRetries >= 0 && opts.maxRetries <= 20,
          '"maxRetries" option must be an integer between 0 and 20 inclusive.');
        if ('__maxRetries' in opts) {
          assert.strictEqual(opts.__maxRetries, opts.maxRetries, 'maxRetries values do not match.');
        }
        opts.__maxRetries = opts.maxRetries;
      }
      
      if ('maxRetry' in opts) {
        assert(Number.isInteger(opts.maxRetry), '"maxRetry" option must be an integer.');
        assert(opts.maxRetry >= 0 && opts.maxRetry <= 20,
          '"maxRetry" option must be an integer between 0 and 20 inclusive.');
        if ('__maxRetries' in opts) {
          assert.strictEqual(opts.__maxRetries, opts.maxRetry, 'maxRetries values do not match.');
        }
        opts.__maxRetries = opts.maxRetry;
      }
      
      if ('retryMax' in opts) {
        assert(Number.isInteger(opts.retryMax), '"retryMax" option must be an integer.');
        assert(opts.retryMax >= 0 && opts.retryMax <= 20,
          '"retryMax" option must be an integer between 0 and 20 inclusive.');
        if ('__maxRetries' in opts) {
          assert.strictEqual(opts.__maxRetries, opts.retryMax, 'maxRetries values do not match.');
        }
        opts.__maxRetries = opts.retryMax;
      }
      
      if (!('__maxRetries' in opts)) {
        opts.__maxRetries = this.lockRetryMax;
      }
      
      assert(Number.isInteger(opts.__maxRetries), '__maxRetries value must be an integer.');
      
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
      
    } catch (err) {
      
      if (typeof cb === 'function') {
        return process.nextTick(cb, err, {});
      }
      
      log.error('No callback was passed to accept the following error.',
        'Please include a callback as the final argument to the client.lock() routine.');
      throw err;
    }
    
    if (process.domain) {
      cb = process.domain.bind(cb as any);
    }
    
    this.lockInternal(key, opts, cb);
    
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
    const maxRetries = opts.__maxRetries;
    const retryCount = opts.__retryCount;
    const forceUnlock = opts.forceUnlock === true;
    
    if (!this.isOpen) {
      return this.fireLockCallbackWithError(cb, new LMXClientLockException(
        key,
        uuid,
        LMXLockRequestError.ConnectionClosed,
        `Connection was closed (and/or a client connection error occurred.)`
      ));
    }
    
    if (retryCount > maxRetries) {
      return this.fireLockCallbackWithError(cb, new LMXClientLockException(
        key,
        uuid,
        LMXLockRequestError.MaxRetries,
        `Maximum retries (${maxRetries}) attempted to acquire lock for key "${key}".`
      ));
    }
    
    const rwStatus = opts.rwStatus || null;
    const max = opts.max;
    
    let timedOut = false;
    
    this.timers[uuid] = setTimeout(() => {
      
      timedOut = true;
      delete this.timers[uuid];
      delete this.resolutions[uuid];
      
      const currentRetryCount = opts.__retryCount;
      const newRetryCount = ++opts.__retryCount;
      
      if (!this.isOpen) {
        this.timeouts[uuid] = true;
        this.write({uuid, key, type: 'lock-client-error'});
        
        return this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          uuid,
          LMXLockRequestError.ConnectionClosed,
          `Connection was closed (and/or a client connection error occurred.)`
        ));
      }
      
      // noRetry
      if (newRetryCount >= maxRetries) {
        
        this.timeouts[uuid] = true;
        this.write({uuid, key, type: 'lock-client-timeout'});
        
        return this.fireLockCallbackWithError(cb, new LMXClientLockException(
          key,
          uuid,
          LMXLockRequestError.RequestTimeoutError,
          `Live-Mutex client lock request timed out after ${lrt * opts.__retryCount} ms, ` +
          `${currentRetryCount} retries attempted to acquire lock for key "${key}".`
        ));
      }
      
      this.emitter.emit('warning',
        `retrying lock request for key '${key}', on host:port '${this.getHost()}:${this.getPort()}', ` +
        `retry attempt # ${newRetryCount}`,
      );
      
      // this has to be called synchronously,
      // so we can get a new resolution callback on the books
      this.lockInternal(key, opts, cb);
      
    }, lrt);
    
    this.resolutions[uuid] = (err, data) => {
      
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
        this.write({uuid, key, type: 'lock-received'}); // we let the broker know that we received the lock
        const boundUnlock = this.unlock.bind(this, key, {_uuid: uuid, rwStatus, force: forceUnlock});
        boundUnlock.acquired = true;
        boundUnlock.readersCount = Number.isInteger(data.readersCount) ? data.readersCount : null;
        boundUnlock.key = key;
        boundUnlock.unlock = boundUnlock.release = boundUnlock;
        boundUnlock.lockUuid = boundUnlock.id = uuid;
        return cb(null, boundUnlock);
      }
      
      if (data.reelection === true) {
        this.cleanUp(uuid);
        return this.lockInternal(key, opts, cb);
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
          
          this.giveups[uuid] = true;
          
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
  
  noop(err?: any) {
    // this is a no-operation, obviously
    // no ref to this, so can't use "this" here
    err && log.error(err);
  }
  
  getPort() {
    return this.port;
  }
  
  getHost() {
    return this.host;
  }
  
  unlock(key: string) : void;
  unlock(key: string, opts: any) : void;
  unlock(key: string, opts: any, cb: LMClientUnlockCallBack): void;
  
  unlock(key: string, opts?: any, cb?: LMClientUnlockCallBack) {
    
    try {
      [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
    } catch (err) {
      if (typeof cb === 'function') {
        return process.nextTick(cb, err, {});
      }
      log.error('No callback was passed to accept the following error.');
      throw err;
    }
    
    if (opts.id) {
      opts._uuid = opts.id;
    }
    
    if (cb && cb !== this.noop) {
      if (process.domain) {
        cb = process.domain.bind(cb as any);
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
    } catch (err) {
      return process.nextTick(cb, err, {});
    }
    
    const uuid = UUID.v4();
    const rwStatus = opts.rwStatus || null;
    const urt = opts.unlockRequestTimeout || this.unlockRequestTimeout;
    let timedOut = false;
    
    this.timers[uuid] = setTimeout(() => {
      
      timedOut = true;
      this.timeouts[uuid] = true;
      
      this.fireUnlockCallbackWithError(cb, new LMXClientUnlockException(
        key, uuid,
        LMXUnlockRequestError.BadOrMismatchedId,
        ` LMX Unlock request to unlock key => "${key}" timed out.`
      ));
      
    }, urt);
    
    this.resolutions[uuid] = (err, data) => {
      
      delete this.timeouts[uuid];
      clearTimeout(this.timers[uuid]);
      
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
        
        // this.write({
        //   uuid: uuid,
        //   key: key,
        //   type: 'unlock-received'
        // });
        
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
