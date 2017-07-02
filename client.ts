'use strict';

//core
import * as util from 'util';
import * as path from 'path';
import * as assert from 'assert';
import * as EE from 'events';

//npm
const WebSocket = require('uws');
const ijson = require('siamese');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');

//project
const debug = require('debug')('live-mutex');

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

const validOptions : Array<string> = [

  'key',
  'listener',
  'host',
  'port',
  'unlockRequestTimeout',
  'lockRequestTimeout',
  'unlockRetryMax',
  'lockRetryMax'

];


function Client($opts, cb) {

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
  this.port = opts.port || '6970';
  this.ttl = weAreDebugging ? 5000000 : ( opts.ttl || 3000);
  this.unlockTimeout = weAreDebugging ? 5000000 : (opts.unlockRequestTimeout || 3000);
  this.lockTimeout = weAreDebugging ? 5000000 : (opts.lockRequestTimeout || 6000);
  this.lockRetryMax = opts.lockRetryMax || 3;
  this.unlockRetryMax = opts.unlockRetryMax || 3;

  const ws = this.ws = new WebSocket(['ws://', this.host, ':', this.port].join(''));

  ws.on('error', err => {
    console.error('\n', ' => Websocket client error => ', err.stack || err, '\n');
  });

  const ee = new EE();

  ws.on('open', () => {
    ws.isOpen = true;
    process.nextTick(() => {
      ee.emit('open', true);
      cb && cb(null, this);
    });
  });

  this.ensure = function (cb) {

    if (cb) {
      cb = cb.bind(this);

      if (ws.isOpen) {
        process.nextTick(cb, null, this);
      }
      else {
        ee.once('open', function () {
          process.nextTick(cb, null, this);
        });
      }
    }
    else {
      return new Promise((resolve) => {
        if (ws.isOpen) {
          resolve(this);
        }
        else {
          ee.once('open', () => {
            resolve(this);
          });
        }
      });
    }

  };

  ws.on('close', () => {
    ws.isOpen = false;
  });

  process.once('exit', function () {
    ws.close();
  });

  this.close = function () {
    ws.close();
  };

  this.bookkeeping = {
    keys: {}
  };

  this.lockholderCount = {};
  this.timeouts = {};
  this.resolutions = {};

  ws.on('message', (msg, flags) => {

    // flags.binary will be set if a binary data is received.
    // flags.masked will be set if the data was masked.

    ijson.parse(msg).then(data => {

      debug('\n', ' => onMessage in lock => ', '\n', colors.blue(util.inspect(data)), '\n');

      if (data.type === 'stats') {
        this.setLockRequestorCount(data.key, data.lockRequestCount);
        return;
      }

      const uuid = data.uuid;
      if (uuid) {

        const fn = this.resolutions[uuid];
        const to = this.timeouts[uuid];

        if (fn && to) {
          throw new Error(' => Fn and to both exists => Live-Mutex implementation error.');
        }
        if (fn) {
          fn.apply(this, [null, data]);
        }
        else if (to) {
          console.error(' => Client side lock/unlock request timed-out.');

          delete this.timeouts[uuid];

          if (data.type === 'lock') {
            ws.send(JSON.stringify({
              uuid: uuid,
              key: data.key,
              pid: process.pid,
              type: 'lock-received-rejected'
            }));
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

  });

}

Client.create = function (opts, cb) {
  try {
    return new Client(opts).ensure()
    .then(c => {
      if (cb) {
        cb(null, c);
      }
      else {
        return c;
      }
    });

  }
  catch (err) {
    if (cb) {
      process.nextTick(function () {
        cb(err);
      });
    }
    else {
      return Promise.reject(err);
    }
  }
};

Client.prototype.addListener = function (key, fn) {
  assert.equal(typeof key, 'string', ' => Key is not a string.');
  assert.equal(typeof fn, 'function', ' => fn is not a function type.');
  const a = this.listeners[key] = this.listeners[key] || [];
  a.push(fn);
};

Client.prototype.setLockRequestorCount = function (key, val) {
  this.lockholderCount[key] = val;
  debug(' => Requestor count => key =>', key, ' => value =>', val);
  const a = this.listeners[key] = this.listeners[key] || [];
  for (var i = 0; i < a.length; i++) {
    a[i].apply(null, [val]);
  }
};

Client.prototype.getLockholderCount = function (key) {
  return this.lockholderCount[key] || 0;
};

Client.prototype.requestLockInfo = function _lock(key, opts, cb) {

  assert(typeof key, 'string', ' => Key passed to live-mutex#lock needs to be a string.');

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

  ws.send(JSON.stringify({
    uuid: uuid,
    key: key,
    type: 'lock-info-request',
  }));

  // if (ws.isOpen) {
  //     send();
  // }
  // else {
  //     ws.once('open', send);
  // }

};

Client.prototype.lock = function _lock(key, opts, cb) {

  assert(typeof key, 'string', ' => Key passed to live-mutex#lock needs to be a string.');

  this.bookkeeping.keys[key] = this.bookkeeping.keys[key] || {
      rawLockCount: 0,
      rawUnlockCount: 0,
      lockCount: 0,
      unlockCount: 0
    };

  this.bookkeeping.keys[key].rawLockCount++;

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

    ws.send(JSON.stringify({
      uuid: uuid,
      key: key,
      pid: process.pid,
      type: 'lock-client-timeout'
    }), function (err) {
      cb(new Error(' => Acquiring lock operation timed out. (Client-side timeout fired) ' +
        (err ? ('\n' + (err.stack || err)) : '')), noop);
    });

  }, lockTimeout);

  this.resolutions[uuid] = (err, data) => {

    this.setLockRequestorCount(key, data.lockRequestCount);

    if (String(key) !== String(data.key)) {
      clearTimeout(to);
      delete this.resolutions[uuid];
      console.error(colors.bgRed(new Error(' !!! bad key !!!').stack));
      return cb(new Error(' => Implementation error.'))
    }

    if (data.error) {
      console.error('\n', colors.bgRed(data.error), '\n');
    }

    if ([data.acquired, data.retry].filter(i => i).length > 1) {
      throw new Error(' => Live-Mutex implementation error.');
    }

    if (data.acquired === true) {
      clearTimeout(to);
      delete this.resolutions[uuid];
      this.bookkeeping.keys[key].lockCount++;

      ws.send(JSON.stringify({
        uuid: uuid,
        key: key,
        pid: process.pid,
        type: 'lock-received'
      }));

      if (data.uuid !== uuid) {
        console.error(' => Something went very wrong.');
        cb(new Error(' => Something went wrong.'));
      }
      else {
        cb(null, this.unlock.bind(this, key, {_uuid: uuid}), data.uuid);
      }
    }
    else if (data.acquired === false) {
      //TODO
    }
    else if (data.retry === true) {
      clearTimeout(to);
      ++opts._retryCount;
      opts._uuid = opts._uuid || uuid;
      this.lock(key, opts, cb);
    }

  };

  ws.send(JSON.stringify({
    uuid: uuid,
    key: key,
    type: 'lock',
    ttl: ttl
  }));

  // setTimeout(function(){
  //     send();
  // },500);

  // process.nextTick(send);

  // if (ws.isOpen) {
  //     send();
  // }
  // else {
  //     ws.once('open', send);
  // }

};

Client.prototype.unlock = function _unlock(key, opts, cb) {

  assert(typeof key, 'string', ' => Key passed to live-mutex#unlock needs to be a string.');

  this.bookkeeping.keys[key] = this.bookkeeping.keys[key] || {
      rawLockCount: 0,
      rawUnlockCount: 0,
      lockCount: 0,
      unlockCount: 0
    };

  this.bookkeeping.keys[key].rawUnlockCount++;

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
    return cb(new Error(' => Maximum retries breached.'));
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
    }

    if (data.unlocked === true) {

      clearTimeout(to);
      this.bookkeeping.keys[key].unlockCount++;

      debug('\n', ' => Lock unlock count (client), key => ', '"' + key + '"', '\n',
        util.inspect(this.bookkeeping.keys[key]), '\n');

      delete this.resolutions[uuid];

      ws.send(JSON.stringify({
        uuid: uuid,
        key: key,
        pid: process.pid,
        type: 'unlock-received'
      }));

      cb(null, data.uuid);
    }
    else if (data.retry === true) {

      debug(' => Retrying the unlock call.');
      clearTimeout(to);
      ++opts._retryCount;
      opts._uuid = opts._uuid || uuid;
      this.unlock(key, opts, cb);
    }

  };

  function send() {
    ws.send(JSON.stringify({
      uuid: uuid,
      key: key,
      _uuid: opts._uuid,
      // we only use force if we have to retry
      force: (opts._retryCount > 0) ? opts.force : false,
      type: 'unlock'
    }));
  }

  // setTimeout(function(){
  //     send();
  // },500);

  process.nextTick(send);

  // if (ws.isOpen) {
  //     send();
  // }
  // else {
  //     ws.once('open', send);
  // }

};

module.exports = Client;
