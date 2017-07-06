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
const WebSocket = require('uws');
const ijson = require('siamese');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');
const JSONStream = require('JSONStream');

//project
const debug = require('debug')('live-mutex');
import lmUtils from './utils';

/////////////////////////////////////////////////////////////////////////

const weAreDebugging = require('./lib/we-are-debugging');
if (weAreDebugging) {
  console.log(' => Live-Mutex client is in debug mode. Timeouts are turned off.');
}

/////////////////////////////////////////////////////////////////////////

process.on('warning', function (w) {
  if (!String(w).match(/DEBUG_FD/) && !String(w).match(/Live.*Mutex/i)) {
    console.error('\n', ' => Live-Mutex warning => ', w.stack || w, '\n');
  }
});

const noop = function (cb) {
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
export type TEnsureCB = (cb: TClientCB) => void;
export type TEnsurePromise = () => Promise<Client>;
export type TEnsure = TEnsurePromise | TEnsureCB;

export interface IUuidBooleanHash {
  [key: string]: boolean;
}

export interface IClientLockOpts {

}

export interface IClientUnlockOpts {

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
  giveups: IUuidBooleanHash;

  ////////////////////////////////////////////////////////////////

  constructor($opts: TClientOptions, cb?: TClientCB) {

    const opts = this.opts = $opts || {};
    assert(typeof opts === 'object', ' => Bad arguments to live-mutex client constructor.');

    if (cb) {
      cb = cb.bind(this);
    }

    Object.keys(opts).forEach(function (key) {
      if (validOptions.indexOf(key) < 0) {
        throw new Error(' => Option passed to Live-Mutex#Client constructor is not a recognized option => "' + key + '"');
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

    const ee = new EE();

    const ws = this.ws = net.createConnection({port: this.port}, () => {
      ws.isOpen = true;
      process.nextTick(() => {
        ee.emit('open', true);
        cb && cb(null, this);
      });
    });

    ws.setEncoding('utf8');

    this.write = function (data, cb) {
      ws.write(JSON.stringify(data) + '\n', 'utf8', cb);
    };

    ws.on('end', () => {
      console.log('disconnected from server');
    });

    this.ensure = function ($cb) {

      if ($cb) {
        if (ws.isOpen) {
          return process.nextTick($cb, null, this);
        }
        const cb = lmUtils.once(this, $cb);
        let to = setTimeout(cb.bind(this, 'err:timeout'), 2000);
        ee.once('open', () => {
          clearTimeout(to);
          process.nextTick(cb, null, this);
        });
      }
      else {
        return new Promise((resolve, reject) => {
          if (ws.isOpen) {
            return resolve(this);
          }
          let to = setTimeout(reject.bind(null, 'err:timeout'), 2000);
          ee.once('open', () => {
            clearTimeout(to);
            resolve(this)
          });

        });
      }
    };

    ws.on('close', () => {
      ws.isOpen = false;
    });

    process.once('exit', function () {
      ws.end();
    });

    this.close = function () {
      return ws.end();
    };

    this.bookkeeping = {};
    this.lockholderCount = {};
    this.timeouts = {};
    this.resolutions = {};
    this.giveups = {};

    // flags.binary will be set if a binary data is received.
    // flags.masked will be set if the data was masked.

    const onData = (ws, msg) => {

      ijson.parse(msg).then(data => {

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
            throw new Error(' => Fn and TO both exist => Live-Mutex implementation error.');
          }
          if (fn) {
            fn.call(this, null, data);
          }
          else if (to) {
            console.error(' => Client side lock/unlock request timed-out.');

            delete this.timeouts[uuid];

            if (data.type === 'lock') {
              this.write({
                uuid: uuid,
                key: data.key,
                pid: process.pid,
                type: 'lock-received-rejected'
              });
            }
          }
          else {
            throw new Error(' => No fn with that uuid in the resolutions hash => \n' + util.inspect(data));
          }
        }
        else {
          console.error(colors.yellow(' => Live-Mutex internal issue => message did not contain uuid =>'), '\n', msg);
        }

      }, function (err) {
        console.error(colors.red.bold(' => Message could not be JSON.parsed => '), msg, '\n', err.stack || err);
      });

    };

    ws.pipe(JSONStream.parse()).on('data', v => {
      onData(ws, v);
    });

  };

  static create(opts: TClientOptions, cb: TClientCB): Promise<Client> {
    return new Client(opts).ensure(cb)
  }

  addListener(key, fn) {
    assert.equal(typeof key, 'string', ' => Key is not a string.');
    assert.equal(typeof fn, 'function', ' => fn is not a function type.');
    const a = this.listeners[key] = this.listeners[key] || [];
    a.push(fn);
  }

  setLockRequestorCount(key, val): void {
    this.lockholderCount[key] = val;
    debug(' => Requestor count => key =>', key, ' => value =>', val);
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

    const ws = this.ws;
    const uuid = opts._uuid || uuidV4();

    this.resolutions[uuid] = (err, data) => {

      if (String(key) !== String(data.key)) {
        delete this.resolutions[uuid];
        throw new Error(' => Live-Mutex implementation error => bad key.');
      }

      if (data.error) {
        console.error('\n', colors.bgRed(data.error), '\n');
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

  lock(key: string, opts: Partial<IClientLockOpts>, cb: TClientLockCB) {

    assert.equal(typeof key, 'string', ' => Key passed to live-mutex#lock needs to be a string.');

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
    cb && (cb = cb.bind(this));

    if ('append' in opts) {
      assert.equal(typeof opts.append, 'string', ' => Live-Mutex usage error => ' +
        '"append" option must be a string value.');
    }

    if ('force' in opts) {
      assert.equal(typeof opts.force, 'boolean', ' => Live-Mutex usage error => ' +
        '"force" option must be a boolean value. Coerce it on your side, for safety.');
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

    if (opts._retryCount > this.lockRetryMax) {
      return cb(new Error(' => Maximum retries breached.'));
    }

    opts._retryCount = opts._retryCount || 0;

    const append = opts.append || '';
    const ws = this.ws;
    const uuid = opts._uuid || (append + uuidV4());
    const ttl = opts.ttl || this.ttl;
    const lockTimeout = opts.lockRequestTimeout || this.lockTimeout;

    const to = setTimeout(() => {

      this.timeouts[uuid] = true;
      delete  this.resolutions[uuid];

      this.write({
        uuid: uuid,
        key: key,
        pid: process.pid,
        type: 'lock-client-timeout'
      });

    }, lockTimeout);

    this.resolutions[uuid] = (err, data) => {

      this.setLockRequestorCount(key, data.lockRequestCount);

      if (String(key) !== String(data.key)) {
        clearTimeout(to);
        delete this.resolutions[uuid];
        console.error(colors.bgRed(new Error(' !!! bad key !!!').stack));
        return cb(new Error(' => Implementation error.'), false)
      }

      if (data.error) {
        console.error('\n', colors.bgRed(data.error), '\n');
        clearTimeout(to);
        return cb(data.error, false);
      }

      if ([data.acquired, data.retry].filter(i => i).length > 1) {
        throw new Error(' => Live-Mutex implementation error.');
      }

      if (data.acquired === true) {
        clearTimeout(to);
        delete this.resolutions[uuid];
        this.bookkeeping[key].lockCount++;

        this.write({
          uuid: uuid,
          key: key,
          pid: process.pid,
          type: 'lock-received'
        });

        if (data.uuid !== uuid) {
          cb(new Error(' => Something went wrong.'), false);
        }
        else {
          cb(null, this.unlock.bind(this, key, {_uuid: uuid}), data.uuid);
        }
      }

      else if (data.retry === true) {
        clearTimeout(to);
        opts._retryCount++;
        opts._uuid = opts._uuid || uuid;
        this.lock(key, opts, cb);
      }
      else if (data.acquired === false) {
        if (opts.once) {
          this.giveups[uuid] = true;
          clearTimeout(to);
          cb(null, false, data.uuid);
        }
      }
      else {
        throw 'fallthrough in condition here 1.';
      }

    };

    this.write({
      uuid: uuid,
      key: key,
      type: 'lock',
      ttl: ttl
    });

  }

  unlock(key: string, opts: Partial<IClientUnlockOpts>, cb: TClientUnlockCB) {

    assert.equal(typeof key, 'string', ' => Key passed to live-mutex#unlock needs to be a string.');

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

    opts._retryCount = opts._retryCount || 0;

    if (opts._retryCount > this.unlockRetryMax) {
      return cb(new Error(' => Maximum retries reached.'));
    }

    const uuid = uuidV4();
    const ws = this.ws;
    const unlockTimeout = opts.unlockRequestTimeout || this.unlockTimeout;

    const to = setTimeout(() => {

      delete this.resolutions[uuid];
      this.timeouts[uuid] = true;
      cb(new Error(' => Unlocking timed out.'));

    }, unlockTimeout);

    this.resolutions[uuid] = (err, data) => {

      this.setLockRequestorCount(key, data.lockRequestCount);

      debug('\n', ' onMessage in unlock =>', '\n', colors.blue(util.inspect(data)), '\n');

      if (String(key) !== String(data.key)) {
        console.error(colors.bgRed(new Error(' !!! bad key !!!').stack));
        return cb(new Error(' => Implementation error.'))
      }

      if ([data.unlocked].filter(i => i).length > 1) {
        throw new Error(' => Live-Mutex implementation error.');
      }

      if (data.error) {
        console.error('\n', colors.bgRed(data.error), '\n');
        clearTimeout(to);
        return cb(data.error);
      }

      if (data.unlocked === true) {

        clearTimeout(to);
        this.bookkeeping[key].unlockCount++;

        debug('\n', ' => Lock unlock count (client), key => ', '"' + key + '"', '\n',
          util.inspect(this.bookkeeping[key]), '\n');

        delete this.resolutions[uuid];

        this.write({
          uuid: uuid,
          key: key,
          pid: process.pid,
          type: 'unlock-received'
        });

        cb(null, data.uuid);
      }
      else if (data.retry === true) {

        debug(' => Retrying the unlock call.');
        clearTimeout(to);
        ++opts._retryCount;
        opts._uuid = opts._uuid || uuid;
        this.unlock(key, opts, cb);
      }
      else {
        throw 'fallthrough in conditional 2';
      }

    };

    this.write({
      uuid: uuid,
      _uuid: opts._uuid,
      key: key,
      // we only use force if we have to retry
      force: (opts._retryCount > 0) ? opts.force : false,
      type: 'unlock'
    });
  }

}

const $exports = module.exports;
export default $exports;



