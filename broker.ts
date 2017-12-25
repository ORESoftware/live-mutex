'use strict';

//core
import * as assert from 'assert';
import * as EE from 'events';
import * as net from 'net';
import * as util from 'util';

//npm
const async = require('async');
const colors = require('chalk');
const uuidV4 = require('uuid/v4');
const JSONStream = require('JSONStream');

//project
import lmUtils from './utils';
import Timer = NodeJS.Timer;
import Socket = NodeJS.Socket;
const loginfo = console.log.bind(console, '[live-mutex broker] =>');
const logerr = console.error.bind(console, '[live-mutex broker] =>');

///////////////////////////////////////////////////////////////////

const weAreDebugging = require('./lib/we-are-debugging');
if (weAreDebugging) {
  logerr('Live-Mutex broker is in debug mode. Timeouts are turned off.');
}

process.setMaxListeners(100);

process.on('warning', function (e) {
  console.error(e.stack || e);
});

///////////////////////////////////////////////////////////////////

const addWsLockKey = function (broker, ws, key) {
  let v;
  if (!(v = broker.wsLock.get(ws))) {
    v = [];
    broker.wsLock.set(ws, v);
  }
  if (v.indexOf(key) < 0) {
    v.push(key);
  }
};

const removeWsLockKey = function (broker, ws, key) {
  let v;
  if (v = broker.wsLock.get(ws)) {
    const i = v.indexOf(key);
    if (i >= 0) {
      v.splice(i, 1);
      return true;
    }
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
  (ws: Socket, data: any, cb?: IErrorFirstCB): void;
}

export interface IUuidWSHash {
  [key: string]: Socket
}

export interface IUuidTimer {
  [key: string]: Timer
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
  to: Timer
}

export interface ILockHash {
  [key: string]: ILockObj
}

export interface INotifyObj {
  ws: Socket,
  uuid: string,
  pid: number,
  ttl: number
}

////////////////////////////////////////////////////////

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
  wsLock: Map<Socket, Array<string>>;  // Array<uuid> to be exact
  wsToKeys: Map<Socket, Array<string>>;
  bookkeeping: IBookkeepingHash;
  isOpen: boolean;
  
  ///////////////////////////////////////////////////////////////
  
  constructor($opts: IBrokerOptsPartial, cb?: IErrorFirstCB) {
    
    this.isOpen = false;
    const opts = this.opts = $opts || {};
    assert(typeof opts === 'object', ' => Bad arguments to live-mutex server constructor.');
    
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
    
    this.send = function (ws, data, cb) {
      
      let cleanUp = () => {
        const key = data.key;
        if (key) {
          const isOwnsKey = removeWsLockKey(this, ws, key);
          if (isOwnsKey) {
            this.unlock({
              key: key,
              force: true
            }, ws);
          }
        }
      };
      
      if (!ws.writable) {
        cleanUp();
        return cb && process.nextTick(cb);
      }
      
      ws.write(JSON.stringify(data) + '\n', 'utf8', err => {
        if (err) {
          process.emit('warning', err);
          cleanUp();
        }
        cb && cb(null);
      });
    };
    
    const onData = (ws, data) => {
      
      const key = data.key;
      
      if (key) {
        let v;
        if (!(v = this.wsToKeys.get(ws))) {
          v = [];
          this.wsToKeys.set(ws, v);
        }
        let index = v.indexOf(key);
        if (index < 0) {
          v.push(key);
        }
      }
      
      if (data.type === 'unlock') {
        this.unlock(data, ws);
      }
      else if (data.type === 'lock') {
        this.lock(data, ws);
      }
      else if (data.type === 'lock-received') {
        this.bookkeeping[data.key].lockCount++;
        clearTimeout(this.timeouts[data.key]);
        delete this.timeouts[data.key];
      }
      else if (data.type === 'unlock-received') {
        const key = data.key;
        clearTimeout(this.timeouts[key]);
        delete this.timeouts[key];
        this.bookkeeping[key].unlockCount++;
      }
      else if (data.type === 'lock-client-timeout') {
        
        // if the client times out, we don't want to send them any more messages
        const lck = this.locks[key];
        const uuid = data.uuid;
        if (!lck) {
          process.emit('warning', `Lock for key "${key}" has probably expired.`);
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
        const lck = this.locks[key];
        if (!lck) {
          process.emit('warning', `Lock for key "${key}" has probably expired.`);
          return;
        }
        this.rejected[data.uuid] = true;
        this.ensureNewLockHolder(lck, data);
      }
      else if (data.type === 'lock-info-request') {
        this.retrieveLockInfo(data, ws);
      }
      else {
        
        process.emit('error', `implementation error, bad data sent to broker => ${util.inspect(data)}`);
        
        this.send(ws, {
          key: data.key,
          uuid: data.uuid,
          error: 'Malformed data sent to Live-Mutex broker.'
        });
      }
      
    };
    
    const connectedClients = new Map();
    
    let firstConnection = true;
    
    const wss = net.createServer(ws => {
      
      process.emit('info', 'client has connected to live-mutex broker.');
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
        this.sendStatsMessageToAllClients();
      }
      
      ws.once('disconnect', function () {
        ws.removeAllListeners();
        connectedClients.delete(ws);
      });
      
      ws.once('end', function () {
        ws.removeAllListeners();
        connectedClients.delete(ws);
      });
      
      ws.on('error', function (err) {
        process.emit('error', new Error('live-mutex client error ' + (err.stack || err)));
      });
      
      if (!this.wsToKeys.get(ws)) {
        this.wsToKeys.set(ws, []);
      }
      
      ws.once('end', () => {
        let keys;
        if (keys = this.wsLock.get(ws)) {
          keys.forEach(k => {
            removeWsLockKey(this, ws, k);
            if (this.locks[k]) {
              this.unlock({
                force: true,
                key: k
              }, ws);
            }
          });
        }
      });
      
      ws.pipe(JSONStream.parse())
      .on('data', v => {
        onData(ws, v);
      })
      .once('error', function (e) {
        this.send(ws, {
            error: String(e.stack || e)
          },
          function () {
            ws.end();
          });
      });
      
    });
    
    let callable = true;
    let sigEvent = function (event) {
      return function () {
        if (!callable) {
          return;
        }
        callable = false;
        process.emit('warning', `${event} event has occurred.`);
        connectedClients.forEach(function (v, k, map) {
          // destroy each connected client
          k.destroy();
        });
        wss.close(function () {
          process.exit(1);
        });
      }
    };
    
    process.once('exit', sigEvent('exit'));
    process.once('uncaughtException', sigEvent('uncaughtException'));
    process.once('SIGINT', sigEvent('SIGINT'));
    process.once('SIGTERM', sigEvent('SIGTERM'));
    
    wss.on('error', function (err) {
      process.emit('error', new Error('live-mutex broker error' + (err.stack || err)));
    });
    
    let count = null;
    
    setInterval(function () {
      wss.getConnections(function (err, data) {
        if (err) {
          process.emit('warning', err);
        }
        else if (data !== count) {
          count = data;
          process.emit('info', 'live-mutex connection information: ' + data);
        }
      });
    }, 8000);
    
    let brokerPromise = null;
    
    this.ensure = this.start = function (cb?: Function) {
      
      if (cb && typeof cb !== 'function') {
        throw new Error('optional argument to ensure/connect must be a function.');
      }
      
      if (brokerPromise) {
        return brokerPromise.then((val) => {
            cb && cb.call(this, null, val);
            return val;
          },
          function (err) {
            cb && cb.call(this, err);
            return Promise.reject(err);
          });
      }
      
      return brokerPromise = new Promise((resolve, reject) => {
        
        let to = setTimeout(function () {
          reject(new Error('Live-Mutex broker error: listening action timed out.'))
        }, 3000);
        
        wss.once('error', reject);
        
        wss.listen(this.port, () => {
          this.isOpen = true;
          clearTimeout(to);
          wss.removeListener('error', reject);
          resolve(this);
        });
        
      })
      .then((val) => {
          cb && cb.call(this, null, val);
          return val;
        },
        function (err) {
          cb && cb.call(this, err);
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
  
  static create(opts: IBrokerOptsPartial, cb?: TBrokerCB): Promise<Broker> {
    return new Broker(opts).ensure(cb);
  }
  
  sendStatsMessageToAllClients() {
    
    const time = Date.now();
    
    // for each client and for each key, we send a message
    const clients = this.wsToKeys.keys();
    
    async.mapSeries(clients, (ws, cb) => {
      
      const keys = this.wsToKeys.get(ws);
      // const keys = obj.keys;
      
      async.mapSeries(keys, (k, cb) => {
        
        const lck = this.locks[k];
        let len = lck ? lck.notify.length : 0;
        
        this.send(ws, {
            type: 'stats',
            key: k,
            lockRequestCount: len
          },
          
          err => {
            cb(null, {
              error: err
            })
          });
        
      }, cb);
      
    }, (err, results) => {
      
      if (err) {
        throw err;
      }
      
      results.filter(function (r) {
        return r && r.error;
      })
      .forEach(function (err) {
        console.error(err.stack || err);
      });
      
      const diff = Date.now() - time;
      const wait = Math.max(1, 1000 - diff);
      
      setTimeout(() => {
        this.sendStatsMessageToAllClients();
      }, wait);
      
    });
    
  }
  
  ensureNewLockHolder(lck, data) {
    
    const locks = this.locks;
    const notifyList = lck.notify;
    
    // currently there is no lock-holder;
    // before we delete the lock object, let's try to find a new lock-holder
    
    lck.uuid = null;
    lck.pid = null;
    
    const key = data.key;
    clearTimeout(lck.to);
    delete lck.to;
    
    let obj;
    if (obj = notifyList.shift()) {
      
      // Sending ws client the "acquired" message
      // set the timeout for the next ws to acquire lock, if not within alloted time, we simple call unlock
      
      let ws = obj.ws;
      let ttl = weAreDebugging ? 50000000 : (obj.ttl || this.lockExpiresAfter);
      
      addWsLockKey(this, ws, key);
      
      let uuid = lck.uuid = obj.uuid;
      lck.pid = obj.pid;
      lck.to = setTimeout(() => {
        
        // delete locks[key]; => no, this.unlock will take care of that
        process.emit('warning', 'Live-Mutex Broker warning, lock object timed out for key => "' + key + '"');
        
        // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid comes into the broker
        // we know that it timed out already, and we know not to throw an error when the lock.uuid doesn't match
        lck.lockholderTimeouts[uuid] = true;
        
        this.unlock({
          key: key,
          force: true
        });
        
      }, ttl);
      
      clearTimeout(this.timeouts[key]);
      delete this.timeouts[key];
      
      this.timeouts[key] = setTimeout(() => {
        
        removeWsLockKey(this, ws, key);
        delete this.timeouts[key];
        
        // if this timeout occurs, that is because the first item in the notify list did not receive the
        // acquire lock message, so we push the object back onto the end of notify list and send a reelection message to all
        // if a client receives a reelection message, they will all retry to acquire the lock on this key
        
        let _lck;
        let count;
        // if this timeout happens, then we can no longer cross-verify uuid's
        if (_lck = locks[key]) {
          _lck.uuid = undefined;
          _lck.pid = undefined;
          count = lck.notify.length;
        }
        else {
          count = 0;
        }
        
        if (!this.rejected[obj.uuid]) {
          notifyList.push(obj);
        }
        
        notifyList.forEach((obj) => {
          this.send(obj.ws, {
            key: data.key,
            uuid: obj.uuid,
            type: 'lock',
            lockRequestCount: count,
            reelection: true
          });
        });
        
      }, this.timeoutToFindNewLockholder);
      
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
  
  retrieveLockInfo(data, ws) {
    
    const locks = this.locks;
    const key = data.key;
    const lck = locks[key];
    const uuid = data.uuid;
    
    const isLocked = lck && lck.uuid && true;
    const lockholderUUID = isLocked ? lck.uuid : null;
    const lockRequestCount = lck ? lck.notify.length : -1;
    
    if (isLocked && lockRequestCount > 0) {
      console.error(' => Live-Mutex implementation warning, lock is unlocked but ' +
        'notify array has at least one item, for key => ', key);
    }
    
    this.send(ws, {
      key, uuid, lockholderUUID,
      lockRequestCount,
      isLocked: !!isLocked,
      lockInfo: true,
      type: 'lock-info-response'
    });
    
  }
  
  lock(data, ws) {
    
    const locks = this.locks;
    const key = data.key;
    const lck = locks[key];
    const uuid = data.uuid;
    const pid = data.pid;
    const ttl = weAreDebugging ? 500000000 : (data.ttl || this.lockExpiresAfter);
    const force = data.force;
    const retryCount = data.retryCount;
    
    this.bookkeeping[key] = this.bookkeeping[key] ||
      {
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
        
        const alreadyAdded = lck.notify.some(function (item) {
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
        lck.to = setTimeout(() => {
          
          // delete locks[key];  => no, this.unlock will take care of that
          process.emit('warning', ' => Live-Mutex Broker warning, lock object timed out for key => "' + key + '"');
          
          // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid might come in to broker
          // we know that it timed out already, and we do not throw an error then
          lck.lockholderTimeouts[uuid] = true;
          
          this.unlock({
            key,
            force: true
          });
          
        }, ttl);
        
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
        lockholderTimeouts: {},
        key,
        notify: [],
        to: setTimeout(() => {
          
          // delete locks[key];  => no!, this.unlock will take care of that
          process.emit('warning', ' => Live-Mutex warning, lock object timed out for key => "' + key + '"');
          
          // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid comes into the broker
          // we know that it timed out already, and we know not to throw an error when the lock.uuid doesn't match
          locks[key] && (locks[key].lockholderTimeouts[uuid] = true);
          
          this.unlock({key, force: true});
          
        }, ttl)
      };
      
      this.send(ws, {
        uuid: uuid,
        lockRequestCount: 0,
        key: key,
        type: 'lock',
        acquired: true
      });
    }
    
  }
  
  unlock(data: Object, ws?: Socket) {
    
    const locks = this.locks;
    const key = data.key;
    const uuid = data.uuid;
    const _uuid = data._uuid;
    const force = data.force;
    const lck = locks[key];
    
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
        const keys = this.wsLock.get(k);
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
      
      process.emit('error', new Error('Live-Mutex implementation error => no lock with key => "' + key + '"'));
      
      // since the lock no longer exists for this key, remove ownership of this key
      this.wsLock.forEach((v, k) => {
        const keys = this.wsLock.get(k);
        if (keys) {
          const i = keys.indexOf[key];
          if (i >= 0) {
            keys.splice(i, 1);
          }
        }
      });
      
      if (ws) {
        
        process.emit('warning', 'Live-Mutex warning, => no lock with key [2] => "' + key + '"');
        
        this.send(ws, {
          uuid: uuid,
          key: key,
          lockRequestCount: 0,
          type: 'unlock',
          unlocked: true,
          error: 'Live-Mutex warning => no lock with key [1] => "' + key + '"'
        });
      }
    }
    
  }
}

// aliases
export const LvMtxBroker = Broker;
export const LMBroker = Broker;
export default Broker;