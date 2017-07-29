'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util");
var assert = require("assert");
var net = require("net");
var ijson = require('siamese');
var uuidV4 = require('uuid/v4');
var colors = require('colors/safe');
var JSONStream = require('JSONStream');
var debug = require('debug')('live-mutex');
var loginfo = console.log.bind(console, ' [live-mutex client] =>');
var logerr = console.error.bind(console, ' [live-mutex client] =>');
var weAreDebugging = require('./lib/we-are-debugging');
if (weAreDebugging) {
    loginfo('Live-Mutex client is in debug mode. Timeouts are turned off.');
}
setTimeout(function () {
    if (process.listenerCount('warning') < 1) {
        loginfo("recommends you attach a process.on('warning') event handler.");
    }
}, 1000);
var totalNoop = function () {
};
var asyncNoop = function (cb) {
    cb && process.nextTick(cb);
};
var validOptions = [
    'key',
    'listener',
    'host',
    'port',
    'unlockRequestTimeout',
    'lockRequestTimeout',
    'unlockRetryMax',
    'lockRetryMax'
];
var Client = (function () {
    function Client($opts, cb) {
        var _this = this;
        this.isOpen = false;
        var opts = this.opts = $opts || {};
        assert(typeof opts === 'object', ' => Bad arguments to live-mutex client constructor.');
        if (cb) {
            assert(typeof cb === 'function', 'optional second argument to Live-Mutex Client constructor must be a function.');
            cb = cb.bind(this);
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
            assert(Number.isInteger(opts.unlockRetryMax), ' => "unlockRetryMax" option needs to be an integer.');
            assert(this.opts.unlockRetryMax >= 0 && opts.unlockRetryMax <= 100, ' => "unlockRetryMax" integer needs to be in range (0-100).');
        }
        if ('lockRetryMax' in opts) {
            assert(Number.isInteger(opts.lockRetryMax), ' => "lockRetryMax" option needs to be an integer.');
            assert(opts.lockRetryMax >= 0 && opts.lockRetryMax <= 100, ' => "lockRetryMax" integer needs to be in range (0-100).');
        }
        if ('unlockRequestTimeout' in opts) {
            assert(Number.isInteger(opts.unlockRequestTimeout), ' => "unlockRequestTimeout" option needs to be an integer (representing milliseconds).');
            assert(opts.unlockRequestTimeout >= 20 && opts.unlockRequestTimeout <= 800000, ' => "unlockRequestTimeout" needs to be integer between 20 and 800000 millis.');
        }
        if ('lockRequestTimeout' in opts) {
            assert(Number.isInteger(opts.lockRequestTimeout), ' => "lockRequestTimeout" option needs to be an integer (representing milliseconds).');
            assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000, ' => "lockRequestTimeout" needs to be integer between 20 and 800000 millis.');
        }
        if ('ttl' in opts) {
            assert(Number.isInteger(opts.ttl), ' => "ttl" option needs to be an integer (representing milliseconds).');
            assert(opts.ttl >= 3 && opts.ttl <= 800000, ' => "ttl" needs to be integer between 3 and 800000 millis.');
        }
        this.listeners = {};
        if (opts.listener) {
            var a = this.listeners[opts.key] = [];
            a.push(opts.listener);
        }
        this.host = opts.host || 'localhost';
        this.port = opts.port || 6970;
        this.ttl = weAreDebugging ? 5000000 : (opts.ttl || 3000);
        this.unlockTimeout = weAreDebugging ? 5000000 : (opts.unlockRequestTimeout || 3000);
        this.lockTimeout = weAreDebugging ? 5000000 : (opts.lockRequestTimeout || 6000);
        this.lockRetryMax = opts.lockRetryMax || 3;
        this.unlockRetryMax = opts.unlockRetryMax || 3;
        var ws = null;
        var connectPromise = null;
        this.write = function (data, cb) {
            if (ws) {
                ws.write(JSON.stringify(data) + '\n', 'utf8', cb);
            }
            else {
                throw new Error('please call connect() on this Live-Mutex client, before using the lock/unlock methods.');
            }
        };
        var onData = function (data) {
            if (data.type === 'stats') {
                _this.setLockRequestorCount(data.key, data.lockRequestCount);
                return;
            }
            var uuid = data.uuid;
            if (uuid) {
                if (_this.giveups[uuid]) {
                    delete _this.giveups[uuid];
                    return;
                }
                var fn = _this.resolutions[uuid];
                var to = _this.timeouts[uuid];
                if (fn && to) {
                    throw new Error('Function and timeout both exist => Live-Mutex implementation error.');
                }
                if (fn) {
                    fn.call(_this, null, data);
                }
                else if (to) {
                    logerr('Client side lock/unlock request timed-out.');
                    delete _this.timeouts[uuid];
                    if (data.type === 'lock') {
                        _this.write({
                            uuid: uuid,
                            key: data.key,
                            pid: process.pid,
                            type: 'lock-received-rejected'
                        });
                    }
                }
                else {
                    logerr('Live-mutex implementation error, ' +
                        'no fn with that uuid in the resolutions hash => \n' + util.inspect(data));
                }
            }
            else {
                logerr(colors.yellow('Live-Mutex implementation issue => message did not contain uuid =>'), '\n', util.inspect(data));
            }
        };
        this.ensure = this.connect = function (cb) {
            var _this = this;
            if (connectPromise) {
                return connectPromise;
            }
            return connectPromise = new Promise(function (resolve, reject) {
                var onFirstErr = function (e) {
                    var err = new Error('live-mutex client error => ' + (e.stack || e));
                    process.emit('warning', err);
                    reject(err);
                };
                var to = setTimeout(function () {
                    reject('live-mutex err: client connection timeout after 2000ms.');
                }, 2000);
                ws = net.createConnection({ port: _this.port }, function () {
                    _this.isOpen = true;
                    clearTimeout(to);
                    ws.removeListener('error', onFirstErr);
                    resolve(_this);
                });
                ws.once('end', function () {
                    loginfo('client stream "end" event occurred.');
                });
                ws.once('error', onFirstErr);
                ws.on('close', function () {
                    _this.isOpen = false;
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
                .then(function (val) {
                cb && (cb = cb.bind(_this)) && cb(null, val);
                return val;
            }, function (err) {
                cb && (cb = cb.bind(_this)) && cb(err);
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
        cb && this.connect(cb);
    }
    ;
    Client.create = function (opts, cb) {
        return new Client(opts).ensure(cb);
    };
    Client.prototype.addListener = function (key, fn) {
        assert.equal(typeof key, 'string', ' => Key is not a string.');
        assert.equal(typeof fn, 'function', ' => fn is not a function type.');
        var a = this.listeners[key] = this.listeners[key] || [];
        a.push(fn);
    };
    Client.prototype.setLockRequestorCount = function (key, val) {
        this.lockholderCount[key] = val;
        var a = this.listeners[key] = this.listeners[key] || [];
        for (var i = 0; i < a.length; i++) {
            a[i].call(null, val);
        }
    };
    Client.prototype.getLockholderCount = function (key) {
        return this.lockholderCount[key] || 0;
    };
    Client.prototype.requestLockInfo = function (key, opts, cb) {
        var _this = this;
        assert.equal(typeof key, 'string', ' => Key passed to live-mutex#lock needs to be a string.');
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        opts = opts || {};
        var uuid = opts._uuid || uuidV4();
        this.resolutions[uuid] = function (err, data) {
            if (String(key) !== String(data.key)) {
                delete _this.resolutions[uuid];
                throw new Error(' => Live-Mutex implementation error => bad key.');
            }
            if (data.error) {
                logerr(colors.bgRed(data.error), '\n');
            }
            if ([data.acquired, data.retry].filter(function (i) { return i; }).length > 1) {
                throw new Error(' => Live-Mutex implementation error.');
            }
            if (data.lockInfo === true) {
                delete _this.resolutions[uuid];
                cb(null, { data: data });
            }
        };
        this.write({
            uuid: uuid,
            key: key,
            type: 'lock-info-request',
        });
    };
    Client.prototype.lockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.lock(key, opts, function (err, unlock, lockUuid) {
                err ? reject(err) : resolve({ key: key, unlock: unlock, lockUuid: lockUuid });
            });
        });
    };
    Client.prototype.unlockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.unlock(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    Client.prototype.lock = function (key, opts, cb) {
        var _this = this;
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
            assert(opts.maxRetries >= 0 && opts.maxRetries <= 20, '"retry" option must be an integer between 0 and 20 inclusive.');
        }
        if ('maxRetry' in opts) {
            assert(Number.isInteger(opts.maxRetry), '"retry" option must be an integer.');
            assert(opts.maxRetry >= 0 && opts.maxRetry <= 20, '"retry" option must be an integer between 0 and 20 inclusive.');
        }
        if ('ttl' in opts) {
            assert(Number.isInteger(opts.ttl), ' => Live-Mutex usage error => Please pass an integer representing milliseconds as the value for "ttl".');
            assert(opts.ttl >= 3 && opts.ttl <= 800000, ' => Live-Mutex usage error => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
        }
        if ('lockRequestTimeout' in opts) {
            assert(Number.isInteger(opts.lockRequestTimeout), ' => Please pass an integer representing milliseconds as the value for "ttl".');
            assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000, ' => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
        }
        opts.__retryCount = opts.__retryCount || 0;
        var append = opts.append || '';
        var uuid = opts._uuid || (append + uuidV4());
        var ttl = opts.ttl || this.ttl;
        var lockTimeout = opts.lockRequestTimeout || this.lockTimeout;
        var maxRetries = opts.maxRetry || opts.maxRetries || this.lockRetryMax;
        if (opts.__retryCount > maxRetries) {
            return cb(new Error("Maximum retries (" + maxRetries + ") attempted."), false);
        }
        var timedOut = false;
        var to = setTimeout(function () {
            timedOut = true;
            _this.timeouts[uuid] = true;
            delete _this.resolutions[uuid];
            _this.write({
                uuid: uuid,
                key: key,
                pid: process.pid,
                type: 'lock-client-timeout'
            });
            opts.__retryCount++;
            if (opts.__retryCount > maxRetries) {
                return cb(new Error("Live-Mutex client lock request timed out after " + lockTimeout + "ms,\n         " + maxRetries + " retries attempted."), false);
            }
            opts._uuid = opts._uuid || uuid;
            logerr('retrying lock request, attempt #', opts.__retryCount);
            _this.lock(key, opts, cb);
        }, lockTimeout);
        var cleanUp = function () {
            clearTimeout(to);
            delete _this.resolutions[uuid];
        };
        var callbackWithError = function (errMsg) {
            cleanUp();
            var err = errMsg instanceof Error ? errMsg : new Error(errMsg);
            process.emit('warning', err);
            cb(err, false);
        };
        this.resolutions[uuid] = function (err, data) {
            if (timedOut) {
                return;
            }
            if (err) {
                return callbackWithError(err);
            }
            if (String(key) !== String(data.key)) {
                return callbackWithError("Live-Mutex bad key, 1 -> ', " + key + ", 2 -> " + data.key);
            }
            _this.setLockRequestorCount(key, data.lockRequestCount);
            if (data.error) {
                return callbackWithError(data.error);
            }
            if (data.acquired === true) {
                cleanUp();
                _this.bookkeeping[key].lockCount++;
                _this.write({
                    uuid: uuid,
                    key: key,
                    pid: process.pid,
                    type: 'lock-received'
                });
                if (data.uuid !== uuid) {
                    return callbackWithError("Live-Mutex error, mismatch in uuids -> '" + data.uuid + "', -> '" + uuid + "'.");
                }
                else {
                    cb(null, _this.unlock.bind(_this, key, { _uuid: uuid }), data.uuid);
                }
            }
            else if (data.reelection === true) {
                cleanUp();
                _this.lock(key, opts, cb);
            }
            else if (data.acquired === false) {
                if (opts.wait === false) {
                    cleanUp();
                    _this.giveups[uuid] = true;
                    cb(null, false, data.uuid);
                }
            }
            else {
                callbackWithError("fallthrough in condition [1]");
            }
        };
        this.write({
            uuid: uuid,
            key: key,
            type: 'lock',
            ttl: ttl
        });
    };
    Client.prototype.unlock = function (key, opts, cb) {
        var _this = this;
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
            assert(Number.isInteger(opts.lockRequestTimeout), ' => Please pass an integer representing milliseconds as the value for "ttl".');
            assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000, ' => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
        }
        var uuid = uuidV4();
        var unlockTimeout = opts.unlockRequestTimeout || this.unlockTimeout;
        var timedOut = false;
        var to = setTimeout(function () {
            timedOut = true;
            delete _this.resolutions[uuid];
            _this.timeouts[uuid] = true;
            var err = new Error('Unlock request timed out.');
            process.emit('warning', err);
            cb && cb(err);
        }, unlockTimeout);
        var cleanUp = function () {
            clearTimeout(to);
            delete _this.resolutions[uuid];
        };
        var callbackWithError = function (errMsg) {
            cleanUp();
            var err = errMsg instanceof Error ? errMsg : new Error(errMsg);
            process.emit('warning', err);
            cb(err);
        };
        this.resolutions[uuid] = function (err, data) {
            if (timedOut) {
                return;
            }
            _this.setLockRequestorCount(key, data.lockRequestCount);
            if (String(key) !== String(data.key)) {
                return callbackWithError('Live-Mutex implementation error, bad key.');
            }
            if (data.error) {
                return callbackWithError(data.error);
            }
            if (data.unlocked === true) {
                cleanUp();
                _this.bookkeeping[key].unlockCount++;
                _this.write({
                    uuid: uuid,
                    key: key,
                    pid: process.pid,
                    type: 'unlock-received'
                });
                cb && cb(null, data.uuid);
            }
            else if (data.unlocked === false) {
                cleanUp();
                cb && cb(data);
            }
            else {
                callbackWithError('fallthrough in conditional [2], Live-Mutex failure.');
            }
        };
        this.write({
            _uuid: opts._uuid,
            uuid: uuid,
            key: key,
            force: (opts.__retryCount > 0) ? !!opts.force : false,
            type: 'unlock'
        });
    };
    return Client;
}());
exports.Client = Client;
exports.LMClient = Client;
exports.LvMtxClient = Client;
exports.default = Client;
