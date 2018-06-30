'use strict';

//core
import * as assert from 'assert';
import * as net from 'net';
import * as util from 'util';
import * as fs from 'fs';

//npm
import chalk from "chalk";
import {createParser} from "./json-parser";
import {LinkedQueue, LinkedQueueValue} from '@oresoftware/linked-queue';
const localDev = process.env.oresoftware_local_dev === 'yes';
const noop = function () {
  // do nothing obviously
};

//project
export const log = {
  info: console.log.bind(console, chalk.gray.bold('[live-mutex info]')),
  error: console.error.bind(console, chalk.red.bold('[live-mutex error]')),
  warn: console.error.bind(console, chalk.yellow.bold('[live-mutex warning]')),
  debug: function (...args: any[]) {
    weAreDebugging && console.log('[live-mutex broker debugging]', ...args);
  }
};

///////////////////////////////////////////////////////////////////

import {weAreDebugging} from './we-are-debugging';
import {EventEmitter} from 'events';
import * as path from "path";
if (weAreDebugging) {
  log.error('broker is in debug mode. Timeouts are turned off.');
}

process.on('warning', function (e: any) {
  log.error('warning:', e && e.message || e);
});

///////////////////////////////////////////////////////////////////

export const validConstructorOptions = {
  lockExpiresAfter: 'integer in millis',
  timeoutToFindNewLockholder: 'integer in millis',
  host: 'string',
  port: 'integer',
  noDelay: 'boolean',
  udsPath: 'string'
};

/////////////////// interfaces /////////////////////////////////////

export interface IBrokerOpts {
  lockExpiresAfter: number;
  timeoutToFindNewLockholder: number;
  host: string;
  port: number;
  noDelay: boolean;
  udsPath: string;
}

export type IBrokerOptsPartial = Partial<IBrokerOpts>
export type IErrorFirstCB = (err: any, val?: any) => void;

export interface BrokerSend {
  (ws: net.Socket, data: any, cb?: IErrorFirstCB): void;
}

export interface IUuidWSHash {
  [key: string]: net.Socket
}

export interface IUuidTimer {
  [key: string]: NodeJS.Timer
}

export type TBrokerCB = (err: any, val: Broker) => void;
export type TEnsure = (cb?: TBrokerCB) => Promise<Broker>;

export interface IBookkeepingHash {
  [key: string]: IBookkeeping;
}

export interface IUuidBooleanHash {
  [key: string]: boolean;
}

export interface LMXSocket extends net.Socket {
  lmxClosed: boolean
}

export interface IBookkeeping {
  rawLockCount: number,
  rawUnlockCount: number;
  lockCount: number;
  unlockCount: number;
}

export interface UuidHash {
  [key: string]: boolean
}

export interface LockObj {
  readers?: number;
  max: number, // max number of lockholders
  count: number, // current number of lockholders
  pid: number,
  lockholderTimeouts: UuidHash,
  uuid: string,
  notify: LinkedQueue, //Array<NotifyObj>,
  key: string,
  keepLocksAfterDeath: boolean
  to: NodeJS.Timer
}

export interface LockHash {
  // key is lock key
  [key: string]: LockObj
}

export interface NotifyObj {
  ws: net.Socket,
  uuid: string,
  pid: number,
  ttl: number,
  keepLocksAfterDeath: boolean
}

/////////////////////////////////////////////////////////////////////////////

export interface KeyToBool {
  [key: string]: boolean
}

export interface UUIDToBool {
  [key: string]: boolean
}

export interface RegisteredListener {
  ws: net.Socket,
  uuid: string,
  key:string
}

export class Broker {

  opts: IBrokerOptsPartial;
  lockExpiresAfter: number;
  timeoutToFindNewLockholder: number;
  host: string;
  port: number;
  send: BrokerSend;
  rejected: IUuidBooleanHash;
  timeouts: IUuidTimer;
  locks: LockHash;
  ensure: TEnsure;
  start: TEnsure;
  wsToUUIDs: Map<net.Socket, UUIDToBool>;  // {uuid: true}
  wsToKeys: Map<net.Socket, KeyToBool>; // {key: true}
  bookkeeping: IBookkeepingHash;
  isOpen: boolean;
  wss: net.Server;
  emitter = new EventEmitter();
  noDelay = true;
  socketFile = '';
  registeredListeners = <{[key:string]: Array<RegisteredListener>}>{};

  ///////////////////////////////////////////////////////////////

  constructor(o?: IBrokerOptsPartial, cb?: IErrorFirstCB) {

    this.isOpen = false;
    const opts = this.opts = o || {};
    assert(typeof opts === 'object', 'Options argument must be an object - live-mutex server constructor.');

    Object.keys(opts).forEach(function (key) {
      if (!validConstructorOptions[key]) {
        throw new Error('An option passed to Live-Mutex#Broker constructor ' +
          `is not a recognized option => "${key}", valid options are: ${util.inspect(validConstructorOptions)}.`);
      }
    });

    if (opts['lockExpiresAfter']) {
      assert(Number.isInteger(opts.lockExpiresAfter),
        ' => "expiresAfter" option needs to be an integer (milliseconds)');
      assert(opts.lockExpiresAfter > 20 && opts.lockExpiresAfter < 4000000,
        ' => "expiresAfter" is not in range (20 to 4000000 ms).');
    }

    if (opts['timeoutToFindNewLockholder']) {
      assert(Number.isInteger(opts.timeoutToFindNewLockholder),
        ' => "timeoutToFindNewLockholder" option needs to be an integer (milliseconds)');
      assert(opts.timeoutToFindNewLockholder > 20 && opts.timeoutToFindNewLockholder < 4000000,
        ' => "timeoutToFindNewLockholder" is not in range (20 to 4000000 ms).');
    }

    if (opts['host']) {
      assert(typeof opts.host === 'string', ' => "host" option needs to be a string.');
    }

    if (opts['port']) {
      assert(Number.isInteger(opts.port),
        ' => "port" option needs to be an integer => ' + opts.port);
      assert(opts.port > 1024 && opts.port < 49152,
        ' => "port" integer needs to be in range (1025-49151).');
    }

    if ('noDelay' in opts && opts['noDelay'] !== undefined) {
      assert(typeof opts.noDelay === 'boolean',
        ' => "noDelay" option needs to be an integer => ' + opts.noDelay);
      this.noDelay = opts.noDelay;
    }

    this.lockExpiresAfter = weAreDebugging ? 5000000 : (opts.lockExpiresAfter || 5000);
    this.timeoutToFindNewLockholder = weAreDebugging ? 5000000 : (opts.timeoutToFindNewLockholder || 4500);
    this.host = opts.host || '127.0.0.1';
    this.port = opts.port || 6970;

    if ('udsPath' in opts && opts['udsPath'] !== undefined) {
      assert(typeof opts.udsPath === 'string', '"udsPath" option must be a string.');
      assert(path.isAbsolute(opts.udsPath), '"udsPath" option must be an absolute path.');
      this.socketFile = path.resolve(opts.udsPath);
    }

    this.emitter.on('warning', () => {
      if (this.emitter.listenerCount('warning') < 2) {
        process.emit.call(process, 'warning', ...Array.from(arguments).map(v => (typeof v === 'string' ? v : util.inspect(v))));
        process.emit.call(process, 'warning', 'Add a "warning" event listener to the Live-Mutex broker to get rid of this message.');
      }
    });

    const self = this;

    this.send = (ws, data, cb) => {

      if (!ws.writable) {
        this.emitter.emit('warning', 'socket is not writable [1].');
        // cleanUp();
        return cb && process.nextTick(cb);
      }

      ws.write(JSON.stringify(data) + '\n', 'utf8', (err: any) => {
        if (err) {
          this.emitter.emit('warning', 'socket is not writable [2].');
          this.emitter.emit('warning', err);
          // cleanUp();
        }
        cb && process.nextTick(cb);
      });
    };

    const onData = (ws: net.Socket, data: any) => {

      const key = data.key;

      if (data.ttl === null) {
        data.ttl = Infinity;
      }

      if (data.inspectCommand) {

        self.inspect(data, ws);

      }
      else if (data.type === 'ls') {

        self.ls(data, ws);

      }
      else if (data.type === 'unlock') {

        self.unlock(data, ws);

      }
      else if (data.type === 'lock') {

        self.lock(data, ws);

      }
      else if (data.type === 'register-listener') {

        self.register(data, ws);

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
          this.emitter.emit('warning', `Lock for key "${key}" has probably expired.`);
          return;
        }

        lck.notify.remove(uuid);

      }
      else if (data.type === 'lock-received-rejected') {

        const lck = self.locks[key];

        if (!lck) {
          this.emitter.emit('warning', `Lock for key "${key}" has probably expired.`);
          return;
        }

        self.rejected[data.uuid] = true;
        self.ensureNewLockHolder(lck, data);

      }
      else if (data.type === 'lock-info-request') {

        self.retrieveLockInfo(data, ws);

      }
      else {

        this.emitter.emit('warning', `implementation error, bad data sent to broker => ${util.inspect(data)}`);

        self.send(ws, {
          key: data.key,
          uuid: data.uuid,
          error: 'Malformed data sent to Live-Mutex broker.'
        });
      }

    };

    const connectedClients = new Map();

    const wss = this.wss = net.createServer((ws: LMXSocket) => {

      connectedClients.set(ws, true);

      if (self.noDelay) {
        ws.setNoDelay(true);
      }

      if (!self.wsToKeys.get(ws)) {
        self.wsToKeys.set(ws, {});
      }

      let endWS = function () {
        try {
          ws.end();
        }
        finally {
          // noop
        }
      };

      let closeSocket = () => {

        if (ws.lmxClosed === true) {
          return;
        }

        ws.lmxClosed = true;

        ws.removeAllListeners();
        connectedClients.delete(ws);

        const v = this.wsToKeys.get(ws);
        this.wsToKeys.delete(ws);

        const uuids = Object.keys(this.wsToUUIDs.get(ws) || {});
        this.wsToUUIDs.delete(ws);

        Object.keys(this.locks).forEach((k) => {

          if (!this.locks[k]) {
            return;
          }

          const notify = this.locks[k].notify;

          // let i = notify.length;
          //
          // while (i--) {
          //   if (notify[i] && notify[i].ws === ws) {
          //     notify.splice(i, 1);
          //   }
          // }

          // Object.keys(uuids).forEach(function (uuid) {
          //   notify.remove(uuid);
          // });

          // if (this.locks[k].isViaShell === false) {
          //   delete v[k];
          //   this.unlock({force: true, key: k, from: 'client socket closed/ended/errored'}, ws);
          // }

          if (!this.locks[k].keepLocksAfterDeath) {
            this.unlock({force: true, key: k, from: 'client socket closed/ended/errored'}, ws);
          }

        });

      };

      ws.once('disconnect', function () {
        closeSocket();
      });

      ws.once('end', () => {
        closeSocket();
      });

      ws.once('error', (err) => {
        this.emitter.emit('warning', 'live-mutex client error ' + (err && err.stack || err));
        closeSocket();
      });

      ws.pipe(createParser())
      .on('data', (v: any) => {
        onData(ws, v);
      })
      .once('error', (e: any) => {
        self.send(ws, {
            error: String(e && e.stack || e)
          },
          () => {
            ws.end();
          });
      });
    });

    let callable = true;
    let sigEvent = (event: any) => {
      return (err: any) => {

        err && this.emitter.emit('warning', err);
        if (!callable) {
          return;
        }

        callable = false;
        this.emitter.emit('warning', chalk.yellow.bold(`[live-mutex broker] "${event}" event has occurred.`));
        connectedClients.forEach(function (v, k) {
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

    wss.on('error', (err) => {
      this.emitter.emit('warning', 'live-mutex broker error' + (err && err.stack || err));
    });

    let brokerPromise: Promise<any> = null;

    this.ensure = this.start = (cb?: TBrokerCB) => {

      if (cb && typeof cb !== 'function') {
        throw new Error('optional argument to ensure/connect must be a function.');
      }

      if (cb && process.domain) {
        cb = process.domain.bind(cb);
      }

      if (brokerPromise) {
        return brokerPromise.then(val => {
            cb && cb.call(self, null, val);
            return val;
          },
          (err) => {
            cb && cb.call(self, err);
            return Promise.reject(err);
          });
      }

      return brokerPromise = new Promise((resolve, reject) => {

        let to = setTimeout(function () {
          reject('Live-Mutex broker error: listening action timed out.')
        }, 3000);

        wss.once('error', reject);

        let cnkt: any = self.socketFile || self.port;
        wss.listen(cnkt, () => {

          self.isOpen = true;
          clearTimeout(to);
          wss.removeListener('error', reject);
          resolve(self);
        });

      })
      .then(val => {
          cb && cb.call(self, null, val);
          return val;
        },
        (err) => {
          cb && cb.call(self, err);
          return Promise.reject(err);
        });

    };

    this.bookkeeping = {};
    this.rejected = {};
    this.timeouts = {};
    this.locks = {};
    this.wsToUUIDs = new Map(); // keys are ws objects, values are lock key maps {uuid: true}
    this.wsToKeys = new Map(); // keys are ws objects, values are key maps {key: true}

    // if the user passes a callback then we call
    // ensure() on behalf of the user
    cb && this.ensure(cb);

  }

  static create(opts: IBrokerOptsPartial): Broker {
    return new Broker(opts);
  }

  on() {
    log.warn('warning:', 'use b.emitter.on() instead of b.on()');
    return this.emitter.on.apply(this.emitter, arguments);
  }

  once() {
    log.warn('warning:', 'use b.emitter.once() instead of b.once()');
    return this.emitter.once.apply(this.emitter, arguments);
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

  ls(data: any, ws: net.Socket) {
    return this.send(ws, {ls_result: Object.keys(this.locks), uuid: data.uuid});
  }


  broadcast(data: any, ws: net.Socket){

    const key = data.key;
    const uuid = data.uuid;
    const v = this.registeredListeners[key] =  this.registeredListeners[key] || [];

    while(v.length){
      let p = v.pop();
      this.send(p.ws, {
        key: data.key,
        uuid: p.uuid,
        type: 'broadcast-result'
      });
    }

    this.send(ws, {
      key: data.key,
      uuid: uuid,
      type: 'broadcast-success'
    });

  }


  register(data: any, ws: net.Socket){

    const key = data.key;
    const uuid = data.uuid;
    const v= this.registeredListeners[key] =  this.registeredListeners[key] || [];
    v.push({ws, key, uuid});

    this.send(ws, {
      key,
      uuid,
      type: 'register-listener-success'
    });

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

  ensureNewLockHolder(lck: LockObj, data: any) {

    const locks = this.locks;
    const notifyList = lck.notify;

    // currently there is no lock-holder;
    // before we delete the lock object, let's try to find a new lock-holder

    lck.uuid = null;
    lck.pid = null;
    lck.keepLocksAfterDeath = null;

    const key = data.key;
    clearTimeout(lck.to);
    delete lck.to;

    const self = this;

    let lqValue: LinkedQueueValue;
    let obj: NotifyObj;

    while (lqValue = notifyList.shift()) {
      obj = lqValue.value;
      if (obj.ws && obj.ws.writable) {
        break;
      }
    }

    if (!obj) {
      // note: only delete lock if no client is remaining to claim it
      // No other connections waiting for lock with key, so we deleted the lock
      delete locks[key];
      return;
    }

    // Sending ws client the "acquired" message
    // set the timeout for the next ws to acquire lock, if not within alloted time, we simple call unlock

    let ws = obj.ws;
    let ttl = obj.ttl;

    if (ttl !== Infinity) {
      ttl = weAreDebugging ? 50000000 : (obj.ttl || this.lockExpiresAfter);
    }

    if (!this.wsToKeys.get(ws)) {
      this.wsToKeys.set(ws, {});
    }

    this.wsToKeys.get(ws)[key] = true;

    let uuid = lck.uuid = obj.uuid;
    lck.pid = obj.pid;
    lck.keepLocksAfterDeath = obj.keepLocksAfterDeath || false;

    if (ttl !== Infinity) {
      lck.to = setTimeout(() => {

        // delete locks[key]; => no, this.unlock will take care of that
        this.emitter.emit('warning', `Live-Mutex Broker warning, lock object timed out after ${ttl}ms for key => "${key}".`);

        // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid comes into the broker
        // we know that it timed out already, and we know not to throw an error when the lock.uuid doesn't match
        lck.lockholderTimeouts[uuid] = true;
        self.unlock({key, force: true, from: 'ttl expired for lock (3)'});

      }, ttl);
    }

    clearTimeout(this.timeouts[key]);
    delete this.timeouts[key];

    this.timeouts[key] = setTimeout(() => {

      try {
        delete this.wsToKeys.get(ws)[key];
      }
      catch (err) {
        // ignore
      }

      delete self.timeouts[key];

      // if this timeout occurs, that is because the first item in the notify list did not receive the
      // acquire lock message, so we push the object back onto the end of notify list and send a reelection message to all
      // if a client receives a reelection message, they will all retry to acquire the lock on this key

      let _lck: LockObj, ln: number;

      // if this timeout happens, then we can no longer cross-verify uuid's
      if (_lck = locks[key]) {
        _lck.uuid = undefined;
        _lck.pid = undefined;
        ln = lck.notify.length;
      }
      else {
        ln = 0;
      }

      if (!self.rejected[obj.uuid]) {
        notifyList.push(obj.uuid, obj);
      }

      notifyList.forEach((lqv: LinkedQueueValue) => {
        const obj = lqv.value;
        self.send(obj.ws, {
          key: data.key,
          uuid: obj.uuid,
          type: 'lock',
          lockRequestCount: ln,
          reelection: true
        });
      });

    }, self.timeoutToFindNewLockholder);

    let ln = lck.notify.length;

    this.send(obj.ws, {
      readersCount: lck.readers,
      key: data.key,
      uuid: obj.uuid,
      type: 'lock',
      lockRequestCount: ln,
      acquired: true
    });

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
      this.emitter.emit('warning', ' => Live-Mutex implementation warning, lock is unlocked but ' +
        'notify array has at least one item, for key => ' + key);
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
    const keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
    const lck = locks[key];
    const uuid = data.uuid;
    const pid = data.pid;
    const max = data.max;  // max lockholders

    const isRWLockWrite = data.isRWLockWrite;
    const beginRead = data.beginRead;
    const endRead = data.endRead;

    let ttl = data.ttl;

    if (ttl !== Infinity) {
      ttl = weAreDebugging ? 500000000 : (data.ttl || this.lockExpiresAfter);
    }

    if (ws && uuid) {
      if (!this.wsToUUIDs.get(ws)) {
        this.wsToUUIDs.set(ws, {});
      }
      this.wsToUUIDs.get(ws)[uuid] = true;
    }

    if (ws && !this.wsToKeys.get(ws)) {
      this.wsToKeys.set(ws, {});
    }

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

      if (beginRead) {
        // lck.readers = Math.max(20, lck.readers++);
        lck.readers++
      }

      if(endRead){
        // in case something weird happens, never let it go below 0
        lck.readers = Math.max(0, --lck.readers);
      }

      if(!isRWLockWrite && !endRead && !beginRead){
        console.log('no end read or begin read')
      }

      if (Number.isInteger(max)) {
        lck.max = max;
      }

      const ln = lck.notify.length;

      if (lck.count >= lck.max) {

        // Lock exists *and* already has a lockholder; adding ws to list of to be notified
        // if we are retrying, we may attempt to call lock() more than once
        // we don't want to push the same ws object / same uuid combo to array

        if (force) {

          // because we use force we put it to the front of the line
          lck.notify.remove(uuid);
          lck.notify.unshift(uuid, {ws, uuid, pid, ttl, keepLocksAfterDeath});

        }
        else {

          const alreadyAdded = lck.notify.get(uuid);

          if (!alreadyAdded) {

            if (retryCount > 0) {
              lck.notify.unshift(uuid, {ws, uuid, pid, ttl, keepLocksAfterDeath});
            }
            else {
              lck.notify.push(uuid, {ws, uuid, pid, ttl, keepLocksAfterDeath});
            }
          }
        }

        this.send(ws, {
          readersCount: lck.readers,
          key: key,
          uuid: uuid,
          lockRequestCount: ln,
          type: 'lock',
          acquired: false
        });
      }
      else {

        lck.pid = pid;
        lck.uuid = uuid;
        lck.count++;

        clearTimeout(lck.to);

        if (ttl !== Infinity) {

          // if are using Infinity, there is no timeout
          // if we are locking with the shell, there is not timeout
          // otherwise if we are using the lib programmatically, we use a timeout

          lck.to = setTimeout(() => {

            // delete locks[key];  => no, this.unlock will take care of that
            this.emitter.emit('warning', 'Live-Mutex Broker warning, [1] lock object timed out for key => "' + key + '"');

            // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid might come in to broker
            // we know that it timed out already, and we do not throw an error then
            locks[key] && (locks[key].lockholderTimeouts[uuid] = true);
            this.unlock({key, force: true, from: 'ttl expired for lock (1)'});

          }, ttl);
        }

        this.wsToKeys.get(ws)[key] = true;

        this.send(ws, {
          readersCount: lck.readers,
          uuid: uuid,
          key: key,
          lockRequestCount: ln,
          type: 'lock',
          acquired: true
        });
      }

    }
    else {

      if (!this.wsToKeys.get(ws)) {
        this.wsToKeys.set(ws, {});
      }

      const readersLocal = beginRead ? 1 : 0;
      console.log('readers local =>', readersLocal);

      this.wsToKeys.get(ws)[key] = true;

      const lckTemp = locks[key] = {
        readers: readersLocal,
        max: max || 1,
        count: 1,
        pid,
        uuid,
        keepLocksAfterDeath,
        lockholderTimeouts: {},
        key,
        notify: new LinkedQueue(),
        to: null
      };

      if (ttl !== Infinity) {
        lckTemp.to = setTimeout(() => {

          // delete locks[key];  => no!, this.unlock will take care of that

          this.emitter.emit('warning', 'Live-Mutex warning, [2] lock object timed out for key => "' + key + '"');

          // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid comes into the broker
          // we know that it timed out already, and we know not to throw an error when the lock.uuid doesn't match
          // have to read the key, not use local lckTemp var
          locks[key] && (locks[key].lockholderTimeouts[uuid] = true);
          this.unlock({key, force: true, from: 'ttl expired for lock (2)'});

        }, ttl);
      }

      this.send(ws, {
        readersCount: lckTemp.readers,
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
    const keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);

    if (ws && keepLocksAfterDeath !== true) {
      // we know for a fact that
      // this websocket connection no longer owns this key
      try {
        delete this.wsToKeys.get(ws)[key];
      }
      catch (err) {
        // ignore
      }
    }

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

      const ln = lck.notify.length;
      clearTimeout(lck.to);

      if (uuid && ws) {

        // if no uuid is defined, then unlock was called by something other than the client
        // aka this library called unlock when there was a timeout

        this.send(ws, {
          uuid: uuid,
          key: key,
          lockRequestCount: ln,
          type: 'unlock',
          unlocked: true
        });
      }

      this.ensureNewLockHolder(lck, data);

    }
    else if (lck) {

      const ln = lck.notify.length;

      if (lck.lockholderTimeouts[_uuid]) {

        delete lck.lockholderTimeouts[_uuid];

        if (uuid && ws) {

          // if no uuid is defined, then unlock was called by something other than the client
          // aka this library called unlock when there was a timeout

          this.send(ws, {
            uuid: uuid,
            key: key,
            lockRequestCount: ln,
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
            lockRequestCount: ln,
            type: 'unlock',
            error: 'You need to pass the correct uuid, or use force.',
            unlocked: false
          });
        }
        else if (ws) {

          this.emitter.emit('warning',
            chalk.red('Implemenation warning - Missing uuid (we have socket connection but no uuid).'));
        }
      }

    }
    else {

      this.emitter.emit('warning', 'Live-Mutex implementation warning => no lock with key => "' + key + '"');

      // since the lock no longer exists for this key, remove ownership of this key
      if (ws && uuid) {

        this.emitter.emit('warning', `Live-Mutex warning, no lock with key => '${key}'.`);

        this.send(ws, {
          uuid: uuid,
          key: key,
          lockRequestCount: 0,
          type: 'unlock',
          unlocked: true,
          warning: `no lock with key => "${key}".`
        });
      }
      else if (ws) {
        this.emitter.emit('warning', chalk.red('Implemenation warning - Missing uuid (we have socket connection but no uuid).'));
      }
    }
  }
}

// aliases
export const LvMtxBroker = Broker;
export const LMBroker = Broker;
export default Broker;