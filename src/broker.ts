'use strict';

//core
import * as assert from 'assert';
import * as EE from 'events';
import * as net from 'net';
import * as util from 'util';

//npm
import chalk from "chalk";
import {createParser} from "./json-parser";

//project
export const log = {
  info: console.log.bind(console, chalk.gray.bold('[live-mutex broker]')),
  error: console.error.bind(console, chalk.gray.bold('[live-mutex broker]'))
};

///////////////////////////////////////////////////////////////////

import {weAreDebugging} from './we-are-debugging';
import * as fs from "fs";

if (weAreDebugging) {
  log.error('broker is in debug mode. Timeouts are turned off.');
}

process.setMaxListeners(100);
process.on('warning', function (e: any) {
  log.error('warning:', e && e.stack || e);
});

///////////////////////////////////////////////////////////////////

const addWsLockKey = function (broker: Broker, ws: net.Socket, key: string) {
  let v: Array<any>;
  if (!(v = broker.wsLock.get(ws))) {
    v = [];
    broker.wsLock.set(ws, v);
  }
  if (v.indexOf(key) < 0) {
    v.push(key);
  }
};

const removeWsLockKey = function (broker: Broker, ws: net.Socket, key: string) {
  let v: Array<any>;
  if (v = broker.wsLock.get(ws)) {
    const i = v.indexOf(key);
    if (i >= 0) {
      v.splice(i, 1);
      return true;
    }
  }
};

const removeKeyFromWsLock = function (keys: Array<string>, key: string) {
  const i = keys.indexOf(key);
  if (i >= 0) {
    keys.splice(i, 1);
    return true;
  }
};

const validOptions = [
  'lockExpiresAfter',
  'timeoutToFindNewLockholder',
  'host',
  'port'
];

/////////////////// interfaces /////////////////////////////////////

export interface IBrokerOpts {
  lockExpiresAfter: number;
  timeoutToFindNewLockholder: number;
  host: string;
  port: number
}

export type IBrokerOptsPartial = Partial<IBrokerOpts>
export type IErrorFirstCB = (err: Error | null | undefined | string, val?: any) => void;

export interface IBrokerSend {
  (ws: net.Socket, data: any, cb?: IErrorFirstCB): void;
}

export interface IUuidWSHash {
  [key: string]: net.Socket
}

export interface IUuidTimer {
  [key: string]: NodeJS.Timer
}

export type TBrokerCB = (err: Error | null | undefined | string, val: Broker) => void;
export type TEnsure = (cb?: TBrokerCB) => Promise<Broker>;

export interface IBookkeepingHash {
  [key: string]: IBookkeeping;
}

export interface IUuidBooleanHash {
  [key: string]: boolean;
}

export interface IBookkeeping {
  rawLockCount: number,
  rawUnlockCount: number;
  lockCount: number;
  unlockCount: number;
}

export interface IUuidHash {
  [key: string]: boolean
}

export interface ILockObj {
  pid: number,
  lockholderTimeouts: IUuidHash,
  uuid: string,
  notify: Array<INotifyObj>,
  key: string,
  isViaShell: boolean
  to: NodeJS.Timer
}

export interface ILockHash {
  [key: string]: ILockObj
}

export interface INotifyObj {
  ws: net.Socket,
  uuid: string,
  pid: number,
  ttl: number
}

/////////////////////////////////////////////////////////////////////////////

export class Broker {
  
  opts: IBrokerOptsPartial;
  lockExpiresAfter: number;
  timeoutToFindNewLockholder: number;
  host: string;
  port: number;
  send: IBrokerSend;
  rejected: IUuidBooleanHash;
  timeouts: IUuidTimer;
  locks: ILockHash;
  ensure: TEnsure;
  start: TEnsure;
  wsLock: Map<net.Socket, Array<string>>;  // Array<uuid> to be exact
  wsToKeys: Map<net.Socket, Array<string>>;
  bookkeeping: IBookkeepingHash;
  isOpen: boolean;
  wss: net.Server;
  
  ///////////////////////////////////////////////////////////////
  
  constructor(o: IBrokerOptsPartial, cb?: IErrorFirstCB) {
    
    this.isOpen = false;
    const opts = this.opts = o || {};
    assert(typeof opts === 'object', 'Options argument must be an object - live-mutex server constructor.');
    
    Object.keys(opts).forEach(function (key) {
      if (validOptions.indexOf(key) < 0) {
        throw new Error(' => Option passed to Live-Mutex#Broker constructor ' +
          'is not a recognized option => "' + key + '"');
      }
    });
    
    if ('lockExpiresAfter' in opts) {
      assert(Number.isInteger(opts.lockExpiresAfter),
        ' => "expiresAfter" option needs to be an integer (milliseconds)');
      assert(opts.lockExpiresAfter > 20 && opts.lockExpiresAfter < 4000000,
        ' => "expiresAfter" is not in range (20 to 4000000 ms).');
    }
    
    if ('timeoutToFindNewLockholder' in opts) {
      assert(Number.isInteger(opts.timeoutToFindNewLockholder),
        ' => "timeoutToFindNewLockholder" option needs to be an integer (milliseconds)');
      assert(opts.timeoutToFindNewLockholder > 20 && opts.timeoutToFindNewLockholder < 4000000,
        ' => "timeoutToFindNewLockholder" is not in range (20 to 4000000 ms).');
    }
    
    if ('host' in opts) {
      assert(typeof opts.host === 'string', ' => "host" option needs to be a string.');
    }
    
    if ('port' in opts) {
      assert(Number.isInteger(opts.port),
        ' => "port" option needs to be an integer => ' + opts.port);
      assert(opts.port > 1024 && opts.port < 49152,
        ' => "port" integer needs to be in range (1025-49151).');
    }
    
    this.lockExpiresAfter = weAreDebugging ? 5000000 : (opts.lockExpiresAfter || 5000);
    this.timeoutToFindNewLockholder = weAreDebugging ? 5000000 : (opts.timeoutToFindNewLockholder || 4500);
    this.host = opts.host || '127.0.0.1';
    this.port = opts.port || 6970;
    
    const self = this;
    
    this.send = (ws, data, cb) => {
      
      let cleanUp = () => {
        const key = data && data.key;
        if (key && removeWsLockKey(this, ws, key)) {
          self.unlock({key: key, force: true}, ws);
        }
      };
      
      if (!ws.writable) {
        process.emit('warning', new Error('socket is not writable 1.'));
        // cleanUp();
        return cb && process.nextTick(cb);
      }
      
      ws.write(JSON.stringify(data) + '\n', 'utf8', function (err: any) {
        if (err) {
          process.emit('warning', new Error('socket is not writable 2.'));
          process.emit('warning', err);
          // cleanUp();
        }
        cb && cb(null);
      });
    };
    
    const onData = (ws: net.Socket, data: any) => {
      
      const key = data.key;
      
      if (key) {
        let v: Array<any>;
        if (!(v = self.wsToKeys.get(ws))) {
          v = [];
          self.wsToKeys.set(ws, v);
        }
        let index = v.indexOf(key);
        if (index < 0) {
          v.push(key);
        }
      }
      
      if (data.inspectCommand) {
        self.inspect(data, ws);
      }
      else if (data.type === 'unlock') {
        self.unlock(data, ws);
      }
      else if (data.type === 'lock') {
        self.lock(data, ws);
      }
      else if (data.type === 'lock-received') {
        self.bookkeeping[data.key].lockCount++;
        clearTimeout(self.timeouts[data.key]);
        delete self.timeouts[data.key];
      }
      else if (data.type === 'unlock-received') {
        const key = data.key;
        clearTimeout(self.timeouts[key]);
        delete self.timeouts[key];
        self.bookkeeping[key].unlockCount++;
      }
      else if (data.type === 'lock-client-timeout') {
        
        // if the client times out, we don't want to send them any more messages
        const lck = self.locks[key];
        const uuid = data.uuid;
        if (!lck) {
          process.emit('warning', new Error(`Lock for key "${key}" has probably expired.`));
          return;
        }
        
        let ln = lck.notify.length;
        for (let i = 0; i < ln; i++) {
          if (lck.notify[i].uuid === uuid) {
            // remove item from notify
            lck.notify.splice(i, 1);
            break;
          }
        }
        
      }
      else if (data.type === 'lock-received-rejected') {
        const lck = self.locks[key];
        if (!lck) {
          process.emit('warning', new Error(`Lock for key "${key}" has probably expired.`));
          return;
        }
        self.rejected[data.uuid] = true;
        self.ensureNewLockHolder(lck, data);
      }
      else if (data.type === 'lock-info-request') {
        self.retrieveLockInfo(data, ws);
      }
      else {
        
        process.emit('warning', new Error(`implementation error, bad data sent to broker => ${util.inspect(data)}`));
        
        self.send(ws, {
          key: data.key,
          uuid: data.uuid,
          error: 'Malformed data sent to Live-Mutex broker.'
        });
      }
      
    };
    
    const connectedClients = new Map();
    let firstConnection = true;
    
    const wss = this.wss = net.createServer((ws) => {
      
      connectedClients.set(ws, true);
      
      let endWS = function () {
        try {
          ws.end();
        }
        finally {
          // noop
        }
      };
      
      if (firstConnection) {
        firstConnection = false;
      }
      
      ws.once('disconnect', function () {
        ws.removeAllListeners();
        connectedClients.delete(ws);
      });
      
      ws.once('end', () => {
        
        ws.removeAllListeners();
        connectedClients.delete(ws);
        
        let keys;
        if (keys = this.wsLock.get(ws)) {
          keys.forEach(k => {
            if (this.locks[k] && this.locks[k].isViaShell === false) {
              removeKeyFromWsLock(keys, k);
              this.unlock({force: true, key: k}, ws);
            }
          });
        }
      });
      
      ws.on('error', function (err) {
        process.emit('warning', new Error('live-mutex client error ' + (err && err.stack || err)));
      });
      
      if (!self.wsToKeys.get(ws)) {
        self.wsToKeys.set(ws, []);
      }
      
      ws.pipe(createParser())
      .on('data', function (v: any) {
        onData(ws, v);
      })
      .once('error', function (e: any) {
        self.send(ws, {
            error: String(e && e.stack || e)
          },
          function () {
            ws.end();
          });
      });
    });
    
    let callable = true;
    let sigEvent = function (event: any) {
      return function (err: any) {
        err && log.error('There was an error:', err);
        if (!callable) {
          return;
        }
        callable = false;
        err && process.emit('warning', err);
        process.emit('warning', new Error(`${event} event has occurred.`));
        connectedClients.forEach(function (v, k, map) {
          // destroy each connected client
          k.destroy();
        });
        wss.close(function () {
          process.exit(1);
        });
      }
    };
    
    process.on('uncaughtException', function (e: any) {
      log.error('Uncaught Exception:', e && e.stack || e);
    });
    
    process.once('exit', sigEvent('exit'));
    process.once('uncaughtException', sigEvent('uncaughtException'));
    process.once('SIGINT', sigEvent('SIGINT'));
    process.once('SIGTERM', sigEvent('SIGTERM'));
    
    wss.on('error', function (err) {
      process.emit('warning', new Error('live-mutex broker error' + (err.stack || err)));
    });
    
    let brokerPromise: Promise<any> = null;
    
    this.ensure = this.start = (cb?: Function) => {
      
      if (cb && typeof cb !== 'function') {
        throw new Error('optional argument to ensure/connect must be a function.');
      }
      
      if (brokerPromise) {
        return brokerPromise.then(function (val) {
            cb && cb.call(self, null, val);
            return val;
          },
          function (err) {
            cb && cb.call(self, err);
            return Promise.reject(err);
          });
      }
      
      return brokerPromise = new Promise((resolve, reject) => {
        
        let to = setTimeout(function () {
          reject(new Error('Live-Mutex broker error: listening action timed out.'))
        }, 3000);
        
        wss.once('error', reject);
        
        
        wss.listen(self.port, () => {
          self.isOpen = true;
          clearTimeout(to);
          wss.removeListener('error', reject);
          resolve(self);
        });
        
      })
      .then(function (val) {
          cb && cb.call(self, null, val);
          return val;
        },
        function (err) {
          cb && cb.call(self, err);
          return Promise.reject(err);
        });
      
    };
    
    this.bookkeeping = {};
    this.rejected = {};
    this.timeouts = {};
    this.locks = {};
    this.wsLock = new Map(); // keys are ws objects, values are lock keys
    this.wsToKeys = new Map(); // keys are ws objects, values are keys []
    
    // if the user passes a callback then we call
    // ensure() on behalf of the user
    cb && this.ensure(cb);
    
  }
  
  static create(opts: IBrokerOptsPartial): Broker {
    return new Broker(opts);
  }
  
  close(cb: Function): void {
    this.wss.close(cb);
  }
  
  getPort() {
    return this.port;
  }
  
  getHost() {
    return this.host;
  }
  
  inspect(data: any, ws: net.Socket) {
    
    if (typeof data.inspectCommand !== 'string') {
      return this.send(ws, {error: 'inspectCommand was not a string'});
    }
    
    switch (data.inspectCommand) {
      
      case 'lockcount':
      case 'lock-count':
      case 'lock_count':
        return this.send(ws, {inspectResult: 5});
      
      case 'clientcount':
      case 'client-count':
      case 'client_count':
        return this.send(ws, {inspectResult: 17});
      
      default:
        return this.send(ws, {inspectResult: 25});
    }
    
  }
  
  ensureNewLockHolder(lck: ILockObj, data: any) {
    
    const locks = this.locks;
    const notifyList = lck.notify;
    
    // currently there is no lock-holder;
    // before we delete the lock object, let's try to find a new lock-holder
    
    lck.uuid = null;
    lck.pid = null;
    
    const key = data.key;
    clearTimeout(lck.to);
    delete lck.to;
    
    const self = this;
    
    let obj: any;
    if (obj = notifyList.shift()) {
      
      // Sending ws client the "acquired" message
      // set the timeout for the next ws to acquire lock, if not within alloted time, we simple call unlock
      
      let ws = obj.ws;
      let ttl = weAreDebugging ? 50000000 : (obj.ttl || this.lockExpiresAfter);
      
      addWsLockKey(this, ws, key);
      
      let uuid = lck.uuid = obj.uuid;
      lck.pid = obj.pid;
      
      lck.to = setTimeout(function () {
        
        // delete locks[key]; => no, this.unlock will take care of that
        process.emit('warning', new Error('Live-Mutex Broker warning, lock object timed out for key => "' + key + '"'));
        
        // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid comes into the broker
        // we know that it timed out already, and we know not to throw an error when the lock.uuid doesn't match
        lck.lockholderTimeouts[uuid] = true;
        self.unlock({
          key: key,
          force: true
        });
        
      }, ttl);
      
      clearTimeout(this.timeouts[key]);
      delete this.timeouts[key];
      
      this.timeouts[key] = setTimeout(() => {
        
        removeWsLockKey(this, ws, key);
        delete self.timeouts[key];
        
        // if this timeout occurs, that is because the first item in the notify list did not receive the
        // acquire lock message, so we push the object back onto the end of notify list and send a reelection message to all
        // if a client receives a reelection message, they will all retry to acquire the lock on this key
        
        let _lck;
        let count: number;
        
        // if this timeout happens, then we can no longer cross-verify uuid's
        if (_lck = locks[key]) {
          _lck.uuid = undefined;
          _lck.pid = undefined;
          count = lck.notify.length;
        }
        else {
          count = 0;
        }
        
        if (!self.rejected[obj.uuid]) {
          notifyList.push(obj);
        }
        
        notifyList.forEach((obj: any) => {
          self.send(obj.ws, {
            key: data.key,
            uuid: obj.uuid,
            type: 'lock',
            lockRequestCount: count,
            reelection: true
          });
        });
        
      }, self.timeoutToFindNewLockholder);
      
      let count = lck.notify.length;
      
      this.send(obj.ws, {
        key: data.key,
        uuid: obj.uuid,
        type: 'lock',
        lockRequestCount: count,
        acquired: true
      });
    }
    else {
      // note: only delete lock if no client is remaining to claim it
      // No other connections waiting for lock with key, so we deleted the lock
      delete locks[key];
    }
    
  }
  
  retrieveLockInfo(data: any, ws: net.Socket) {
    
    const locks = this.locks;
    const key = data.key;
    const lck = locks[key];
    const uuid = data.uuid;
    
    const isLocked = lck && lck.uuid && true;
    const lockholderUUID = isLocked ? lck.uuid : null;
    const lockRequestCount = lck ? lck.notify.length : -1;
    
    if (isLocked && lockRequestCount > 0) {
      process.emit('warning', new Error(' => Live-Mutex implementation warning, lock is unlocked but ' +
        'notify array has at least one item, for key => ' + key));
    }
    
    this.send(ws, {
      key, uuid, lockholderUUID,
      lockRequestCount,
      isLocked: Boolean(isLocked),
      lockInfo: true,
      type: 'lock-info-response'
    });
    
  }
  
  lock(data: any, ws: net.Socket) {
    
    const locks = this.locks;
    const key = data.key;
    const isViaShell = Boolean(data.isViaShell);
    const lck = locks[key];
    const uuid = data.uuid;
    const pid = data.pid;
    const ttl = weAreDebugging ? 500000000 : (data.ttl || this.lockExpiresAfter);
    const force = data.force;
    const retryCount = data.retryCount;
    
    this.bookkeeping[key] = this.bookkeeping[key] || {
      rawLockCount: 0,
      rawUnlockCount: 0,
      lockCount: 0,
      unlockCount: 0
    };
    
    this.bookkeeping[key].rawLockCount++;
    
    if (lck) {
      
      const count = lck.notify.length;
      
      if (lck.uuid) {
        
        // Lock exists *and* already has a lockholder; adding ws to list of to be notified
        // if we are retrying, we may attempt to call lock() more than once
        // we don't want to push the same ws object / same uuid combo to array
        
        const alreadyAdded = lck.notify.some((item) => {
          return String(item.uuid) === String(uuid);
        });
        
        if (!alreadyAdded) {
          if (retryCount > 0) {
            lck.notify.unshift({ws, uuid, pid, ttl});
          }
          else {
            lck.notify.push({ws, uuid, pid, ttl});
          }
        }
        
        this.send(ws, {
          key: key,
          uuid: uuid,
          lockRequestCount: count,
          type: 'lock',
          acquired: false
        });
      }
      else {
        
        lck.pid = pid;
        lck.uuid = uuid;
        
        clearTimeout(lck.to);
        
        if (isViaShell === false) {
          
          // if we are locking with the shell, there is not timeout
          // otherwise if we are using the lib programmatically
          // we use a timeout
          
          lck.to = setTimeout(() => {
            
            // delete locks[key];  => no, this.unlock will take care of that
            process.emit('warning', new Error('Live-Mutex Broker warning, lock object timed out for key => "' + key + '"'));
            
            // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid might come in to broker
            // we know that it timed out already, and we do not throw an error then
            lck.lockholderTimeouts[uuid] = true;
            
            this.unlock({
              key,
              force: true
            });
            
          }, ttl);
        }
        
        addWsLockKey(this, ws, key);
        
        this.send(ws, {
          uuid: uuid,
          key: key,
          lockRequestCount: count,
          type: 'lock',
          acquired: true
        });
      }
      
    }
    else {
      
      addWsLockKey(this, ws, key);
      
      locks[key] = {
        pid,
        uuid,
        isViaShell,
        lockholderTimeouts: {},
        key,
        notify: [],
        to: null
      };
      
      if (isViaShell === false) {
        locks[key].to = setTimeout(() => {
          // delete locks[key];  => no!, this.unlock will take care of that
          process.emit('warning', new Error('Live-Mutex warning, lock object timed out for key => "' + key + '"'));
          // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid comes into the broker
          // we know that it timed out already, and we know not to throw an error when the lock.uuid doesn't match
          locks[key] && (locks[key].lockholderTimeouts[uuid] = true);
          this.unlock({key, force: true});
        }, ttl);
      }
      
      this.send(ws, {
        uuid: uuid,
        lockRequestCount: 0,
        key: key,
        type: 'lock',
        acquired: true
      });
    }
    
  }
  
  unlock(data: any, ws?: net.Socket) {
    
    const locks = this.locks;
    const key = data.key;
    const uuid = data.uuid;
    const _uuid = data._uuid;
    const force = data.force;
    const lck = locks[key];
    
    const self = this;
    
    this.bookkeeping[key] = this.bookkeeping[key] || {
      rawLockCount: 0,
      rawUnlockCount: 0,
      lockCount: 0,
      unlockCount: 0
    };
    
    this.bookkeeping[key].rawUnlockCount++;
    
    // if the user passed _uuid, then we check it, other true
    // _uuid is the uuid of the original lockholder call
    // the unlock caller can be given right to unlock only if it holds
    // the uuid from the original lock call, as a safeguard
    // this prevents a function from being called at the wrong time, or more than once, etc.
    
    let same = true;
    
    if (_uuid && lck && lck.uuid !== undefined) {
      same = (String(lck.uuid) === String(_uuid));
    }
    
    if (lck && (same || force)) {
      
      const count = lck.notify.length;
      clearTimeout(lck.to);
      
      if (uuid && ws) {
        
        // if no uuid is defined, then unlock was called by something other than the client
        // aka this library called unlock when there was a timeout
        
        this.send(ws, {
          uuid: uuid,
          key: key,
          lockRequestCount: count,
          type: 'unlock',
          unlocked: true
        });
      }
      
      this.wsLock.forEach((v, k) => {
        const keys = self.wsLock.get(k);
        if (keys) {
          const i = keys.indexOf(key);
          if (i >= 0) {
            keys.splice(i, 1);
          }
        }
      });
      
      this.ensureNewLockHolder(lck, data);
      
    }
    else if (lck) {
      
      const count = lck.notify.length;
      
      if (lck.lockholderTimeouts[_uuid]) {
        
        delete lck.lockholderTimeouts[_uuid];
        
        if (uuid && ws) {
          // if no uuid is defined, then unlock was called by something other than the client
          // aka this library called unlock when there was a timeout
          
          this.send(ws, {
            uuid: uuid,
            key: key,
            lockRequestCount: count,
            type: 'unlock',
            unlocked: true
          });
        }
      }
      else {
        
        if (uuid && ws) {
          // if no uuid is defined, then unlock was called by something other than the client
          // aka this library called unlock when there was a timeout
          
          this.send(ws, {
            uuid: uuid,
            key: key,
            lockRequestCount: count,
            type: 'unlock',
            error: 'You need to pass the correct uuid, or use force.',
            unlocked: false
          });
        }
      }
      
    }
    else {
      
      process.emit('warning', new Error('Live-Mutex implementation error => no lock with key => "' + key + '"'));
      
      // since the lock no longer exists for this key, remove ownership of this key
      this.wsLock.forEach((v, k) => {
        const keys = self.wsLock.get(k);
        if (keys) {
          const i = keys.indexOf[key];
          if (i >= 0) {
            keys.splice(i, 1);
          }
        }
      });
      
      if (ws) {
        
        process.emit('warning', new Error(`Live-Mutex warning, [2] no lock with key => '${key}'.`));
        
        this.send(ws, {
          uuid: uuid,
          key: key,
          lockRequestCount: 0,
          type: 'unlock',
          unlocked: true,
          error: `Live-Mutex warning => [1] no lock with key  => '${key}'.`
        });
      }
    }
    
  }
}

// aliases
export const LvMtxBroker = Broker;
export const LMBroker = Broker;
export default Broker;