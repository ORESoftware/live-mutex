'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util");
var assert = require("assert");
var EE = require("events");
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
        loginfo('recommends you attach a process.on("warning") event handler.');
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
        var ee = new EE();
        var ws = null;
        var connectPromise = null;
        this.write = function (data, cb) {
            if (ws) {
                ws.write(JSON.stringify(data) + '\n', 'utf8', cb);
            }
            else {
                throw new Error('please call connect() on this Live-Mutex client, before using.');
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
                cb && cb(null, val);
                return val;
            }, function (err) {
                cb && cb(err);
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
        cb && (cb = cb.bind(this));
        if ('append' in opts) {
            assert.equal(typeof opts.append, 'string', ' => Live-Mutex usage error => ' +
                '"append" option must be a string value.');
        }
        if ('force' in opts) {
            assert.equal(typeof opts.force, 'boolean', ' => Live-Mutex usage error => ' +
                '"force" option must be a boolean value. Coerce it on your side, for safety.');
        }
        if ('retry' in opts) {
            assert(Number.isInteger(opts.retry), '"retry" option must be an integer.');
            assert(opts.retry >= 0 && opts.retry <= 20, '"retry" option must be an integer between 0 and 20 inclusive.');
        }
        if ('ttl' in opts) {
            assert(Number.isInteger(opts.ttl), ' => Live-Mutex usage error => Please pass an integer representing milliseconds as the value for "ttl".');
            assert(opts.ttl >= 3 && opts.ttl <= 800000, ' => Live-Mutex usage error => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
        }
        if ('lockRequestTimeout' in opts) {
            assert(Number.isInteger(opts.lockRequestTimeout), ' => Please pass an integer representing milliseconds as the value for "ttl".');
            assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000, ' => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
        }
        if (Number.isInteger(opts.retry) && opts._retryCount > opts.retry) {
            return cb(new Error("Maximum retries " + opts.retry + " attempted."));
        }
        if (opts._retryCount > this.lockRetryMax) {
            return cb(new Error("Maximum retries " + this.lockRetryMax + " attempted."));
        }
        opts._retryCount = opts._retryCount || 0;
        var append = opts.append || '';
        var uuid = opts._uuid || (append + uuidV4());
        var ttl = opts.ttl || this.ttl;
        var lockTimeout = opts.lockRequestTimeout || this.lockTimeout;
        var to = setTimeout(function () {
            _this.timeouts[uuid] = true;
            delete _this.resolutions[uuid];
            _this.write({
                uuid: uuid,
                key: key,
                pid: process.pid,
                type: 'lock-client-timeout'
            });
        }, lockTimeout);
        this.resolutions[uuid] = function (err, data) {
            _this.setLockRequestorCount(key, data.lockRequestCount);
            if (String(key) !== String(data.key)) {
                clearTimeout(to);
                delete _this.resolutions[uuid];
                var err_1 = new Error("Live-Mutex bad key, 1 -> ', " + key + ", 2 -> " + data.key);
                process.emit('warning', err_1);
                return cb(err_1, false);
            }
            if (data.error) {
                var err_2 = new Error(data.error);
                process.emit('warning');
                clearTimeout(to);
                return cb(err_2, false);
            }
            if ([data.acquired, data.retry].filter(function (i) { return i; }).length > 1) {
                process.emit('error', 'Nasty Live-Mutex implementation error.');
            }
            if (data.acquired === true) {
                clearTimeout(to);
                delete _this.resolutions[uuid];
                _this.bookkeeping[key].lockCount++;
                _this.write({
                    uuid: uuid,
                    key: key,
                    pid: process.pid,
                    type: 'lock-received'
                });
                if (data.uuid !== uuid) {
                    var err_3 = new Error("Live-Mutex error, mismatch in uuids -> " + data.uuid + ", -> " + uuid);
                    process.emit('warning', err_3);
                    cb(err_3, false);
                }
                else {
                    cb(null, _this.unlock.bind(_this, key, { _uuid: uuid }), data.uuid);
                }
            }
            else if (data.retry === true) {
                clearTimeout(to);
                opts._retryCount++;
                opts._uuid = opts._uuid || uuid;
                logerr('retrying lock request, attempt #', opts._retryCount);
                _this.lock(key, opts, cb);
            }
            else if (data.acquired === false) {
                if (opts.retry) {
                    _this.giveups[uuid] = true;
                    clearTimeout(to);
                    cb(null, false, data.uuid);
                }
            }
            else {
                process.emit('warning', new Error("fallthrough in condition [1]"));
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
        if (cb && !opts._retryCount) {
            cb = cb.bind(this);
        }
        cb = cb || totalNoop;
        if ('force' in opts) {
            assert.equal(typeof opts.force, 'boolean', ' => Live-Mutex usage error => ' +
                '"force" option must be a boolean value. Coerce it on your side, for safety.');
        }
        if ('unlockRequestTimeout' in opts) {
            assert(Number.isInteger(opts.lockRequestTimeout), ' => Please pass an integer representing milliseconds as the value for "ttl".');
            assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000, ' => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
        }
        opts._retryCount = opts._retryCount || 0;
        if (opts._retryCount > this.unlockRetryMax) {
            var err = new Error(' => Maximum retries reached.');
            process.emit('warning', err);
            return cb && cb(err);
        }
        var uuid = uuidV4();
        var unlockTimeout = opts.unlockRequestTimeout || this.unlockTimeout;
        var to = setTimeout(function () {
            delete _this.resolutions[uuid];
            _this.timeouts[uuid] = true;
            var err = new Error('Unlock request timed out.');
            process.emit('warning', err);
            cb(err);
        }, unlockTimeout);
        this.resolutions[uuid] = function (err, data) {
            _this.setLockRequestorCount(key, data.lockRequestCount);
            if (String(key) !== String(data.key)) {
                var err_4 = new Error(' => Implementation error, bad key.');
                process.emit('warning', err_4);
                return cb && cb(err_4);
            }
            if ([data.unlocked].filter(function (i) { return i; }).length > 1) {
                var err_5 = new Error(' => Live-Mutex implementation error.');
                process.emit('warning', err_5);
                return cb && cb(err_5);
            }
            if (data.error) {
                clearTimeout(to);
                process.emit('warning', new Error(data.error));
                return cb && cb(data.error);
            }
            if (data.unlocked === true) {
                clearTimeout(to);
                _this.bookkeeping[key].unlockCount++;
                delete _this.resolutions[uuid];
                _this.write({
                    uuid: uuid,
                    key: key,
                    pid: process.pid,
                    type: 'unlock-received'
                });
                cb && cb(null, data.uuid);
            }
            else if (data.retry === true) {
                clearTimeout(to);
                ++opts._retryCount;
                opts._uuid = opts._uuid || uuid;
                _this.unlock(key, opts, cb);
            }
            else {
                process.emit('warning', 'fallthrough in conditional [2], Live-Mutex failure.');
            }
        };
        this.write({
            _uuid: opts._uuid,
            uuid: uuid,
            key: key,
            force: (opts._retryCount > 0) ? !!opts.force : false,
            type: 'unlock'
        });
    };
    return Client;
}());
exports.Client = Client;
exports.LMClient = Client;
exports.LvMtxClient = Client;
exports.default = Client;
