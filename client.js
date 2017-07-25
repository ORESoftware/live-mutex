'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util");
var assert = require("assert");
var EE = require("events");
var net = require("net");
var WebSocket = require('uws');
var ijson = require('siamese');
var uuidV4 = require('uuid/v4');
var colors = require('colors/safe');
var JSONStream = require('JSONStream');
var debug = require('debug')('live-mutex');
var utils_1 = require("./utils");
var weAreDebugging = require('./lib/we-are-debugging');
if (weAreDebugging) {
    console.log(' => Live-Mutex client is in debug mode. Timeouts are turned off.');
}
process.on('warning', function (w) {
    if (!String(w).match(/DEBUG_FD/) && !String(w).match(/Live.*Mutex/i)) {
        console.error('\n', ' => Live-Mutex warning => ', w.stack || w, '\n');
    }
});
var noop = function (cb) {
    cb && process.nextTick(cb);
};
var totalNoop = function () { };
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
        var ws = net.createConnection({ port: this.port }, function () {
            _this.isOpen = true;
            process.nextTick(function () {
                ee.emit('open', true);
                cb && cb(null, _this);
            });
        });
        ws.setEncoding('utf8');
        this.write = function (data, cb) {
            ws.write(JSON.stringify(data) + '\n', 'utf8', cb);
        };
        ws.on('end', function () {
            console.log('disconnected from server');
        });
        this.ensure = function ($cb) {
            var _this = this;
            if ($cb) {
                if (this.isOpen) {
                    return process.nextTick($cb, null, this);
                }
                var cb_1 = utils_1.default.once(this, $cb);
                var to_1 = setTimeout(cb_1.bind(this, 'err:timeout'), 2000);
                ee.once('open', function () {
                    clearTimeout(to_1);
                    process.nextTick(cb_1, null, _this);
                });
            }
            else {
                return new Promise(function (resolve, reject) {
                    if (_this.isOpen) {
                        return resolve(_this);
                    }
                    var to = setTimeout(reject.bind(null, 'err:timeout'), 2000);
                    ee.once('open', function () {
                        clearTimeout(to);
                        resolve(_this);
                    });
                });
            }
        };
        ws.on('close', function () {
            _this.isOpen = false;
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
                    throw new Error(' => Function and timeout both exist => Live-Mutex implementation error.');
                }
                if (fn) {
                    fn.call(_this, null, data);
                }
                else if (to) {
                    console.error(' => Client side lock/unlock request timed-out.');
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
                    throw new Error(' => No fn with that uuid in the resolutions hash => \n' + util.inspect(data));
                }
            }
            else {
                console.error(colors.yellow(' => Live-Mutex internal issue => message did not contain uuid =>'), '\n', util.inspect(data));
            }
        };
        ws.pipe(JSONStream.parse()).on('data', onData)
            .once('error', function (e) {
            this.sened(ws, {
                error: String(e.stack || e)
            }, function () {
                ws.end();
            });
        });
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
                console.error('\n', colors.bgRed(data.error), '\n');
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
            assert(Number.isInteger(opts.ttl), ' => Live-Mutex usage error => Please pass an integer representing milliseconds as the value for "ttl".');
            assert(opts.ttl >= 3 && opts.ttl <= 800000, ' => Live-Mutex usage error => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
        }
        if ('lockRequestTimeout' in opts) {
            assert(Number.isInteger(opts.lockRequestTimeout), ' => Please pass an integer representing milliseconds as the value for "ttl".');
            assert(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000, ' => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
        }
        if (opts._retryCount > this.lockRetryMax) {
            return cb(new Error(' => Maximum retries breached.'));
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
                process.emit('warning', new Error(data.error));
                clearTimeout(to);
                return cb(data.error, false);
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
                    var err_2 = new Error("Live-Mutex error, mismatch in uuids -> " + data.uuid + ", -> " + uuid);
                    process.emit('warning', err_2);
                    cb(err_2, false);
                }
                else {
                    cb(null, _this.unlock.bind(_this, key, { _uuid: uuid }), data.uuid);
                }
            }
            else if (data.retry === true) {
                clearTimeout(to);
                opts._retryCount++;
                opts._uuid = opts._uuid || uuid;
                _this.lock(key, opts, cb);
            }
            else if (data.acquired === false) {
                if (opts.once) {
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
                var err_3 = new Error(' => Implementation error, bad key.');
                process.emit('warning', err_3);
                return cb && cb(err_3);
            }
            if ([data.unlocked].filter(function (i) { return i; }).length > 1) {
                var err_4 = new Error(' => Live-Mutex implementation error.');
                process.emit('warning', err_4);
                return cb && cb(err_4);
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
                debug(' => Retrying the unlock call.');
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
            force: (opts._retryCount > 0) ? opts.force : false,
            type: 'unlock'
        });
    };
    return Client;
}());
exports.Client = Client;
