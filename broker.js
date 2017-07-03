'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util");
var assert = require("assert");
var EE = require("events");
var WebSocket = require('uws');
var WebSocketServer = WebSocket.Server;
var ijson = require('siamese');
var async = require('async');
var colors = require('colors/safe');
var uuidV4 = require('uuid/v4');
var utils_1 = require("./utils");
var debug = require('debug')('live-mutex');
var weAreDebugging = require('./lib/we-are-debugging');
if (weAreDebugging) {
    console.log(' => Live-Mutex broker is in debug mode. Timeouts are turned off.');
}
function addWsLockKey(broker, ws, key) {
    var v;
    if (!(v = broker.wsLock.get(ws))) {
        v = [];
        broker.wsLock.set(ws, v);
    }
    if (v.indexOf(key) < 0) {
        v.push(key);
    }
}
function removeWsLockKey(broker, ws, key) {
    var v;
    if (v = broker.wsLock.get(ws)) {
        var i = v.indexOf(key);
        if (i >= 0) {
            v.splice(i, 1);
            return true;
        }
    }
}
var validOptions = [
    'lockExpiresAfter',
    'timeoutToFindNewLockholder',
    'host',
    'port'
];
var Broker = (function () {
    function Broker($opts, cb) {
        var _this = this;
        var opts = this.opts = $opts || {};
        assert(typeof opts === 'object', ' => Bad arguments to live-mutex server constructor.');
        Object.keys(opts).forEach(function (key) {
            if (validOptions.indexOf(key) < 0) {
                throw new Error(' => Option passed to Live-Mutex#Broker constructor ' +
                    'is not a recognized option => "' + key + '"');
            }
        });
        if ('lockExpiresAfter' in opts) {
            assert(Number.isInteger(opts.lockExpiresAfter), ' => "expiresAfter" option needs to be an integer (milliseconds)');
            assert(opts.lockExpiresAfter > 20 && opts.lockExpiresAfter < 4000000, ' => "expiresAfter" is not in range (20 to 4000000 ms).');
        }
        if ('timeoutToFindNewLockholder' in opts) {
            assert(Number.isInteger(opts.timeoutToFindNewLockholder), ' => "timeoutToFindNewLockholder" option needs to be an integer (milliseconds)');
            assert(opts.timeoutToFindNewLockholder > 20 && opts.timeoutToFindNewLockholder < 4000000, ' => "timeoutToFindNewLockholder" is not in range (20 to 4000000 ms).');
        }
        if ('host' in opts) {
            assert(typeof opts.host === 'string', ' => "host" option needs to be a string.');
        }
        if ('port' in opts) {
            assert(Number.isInteger(opts.port), ' => "port" option needs to be an integer => ' + opts.port);
            assert(opts.port > 1024 && opts.port < 49152, ' => "port" integer needs to be in range (1025-49151).');
        }
        this.lockExpiresAfter = weAreDebugging ? 5000000 : (opts.lockExpiresAfter || 5000);
        this.timeoutToFindNewLockholder = weAreDebugging ? 5000000 : (opts.timeoutToFindNewLockholder || 4500);
        this.host = opts.host || '127.0.0.1';
        this.port = opts.port || 6970;
        this.send = function (ws, data, cb) {
            var _this = this;
            if (ws.readyState !== WebSocket.OPEN) {
                cb && cb('err: Socket is not OPEN.');
                return;
            }
            ws.send(JSON.stringify(data), function (err) {
                if (err) {
                    console.error(err.stack || err);
                    var key = data.key;
                    if (key) {
                        var isOwnsKey = removeWsLockKey(_this, ws, key);
                        if (isOwnsKey) {
                            _this.unlock({
                                key: key,
                                force: true
                            }, ws);
                        }
                    }
                }
                cb && cb(null);
            });
        };
        var ee = new EE();
        var wss = this.wss = new WebSocketServer({
            port: this.port,
            host: this.host
        }, function () {
            wss.isOpen = true;
            process.nextTick(function () {
                ee.emit('open', true);
                cb && cb(null, _this);
            });
        });
        this.ensure = function ($cb) {
            var _this = this;
            if ($cb) {
                if (wss.isOpen) {
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
                    if (wss.isOpen) {
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
        wss.on('error', function (err) {
            console.error(' => WSS error => ', err.stack || err);
        });
        this.bookkeeping = {};
        this.rejected = {};
        this.timeouts = {};
        this.locks = {};
        this.wsLock = new Map();
        this.wsToKeys = new Map();
        var first = true;
        wss.on('connection', function (ws) {
            if (first) {
                first = false;
                _this.sendStatsMessageToAllClients();
            }
            ws.on('error', function (err) {
                console.error(' => ws error => ', err.stack || err);
            });
            if (!_this.wsToKeys.get(ws)) {
                _this.wsToKeys.set(ws, []);
            }
            ws.on('close', function () {
                console.log(' => Client connection closed, with ws = "' + ws + '".');
                var keys;
                if (keys = _this.wsLock.get(ws)) {
                    keys.forEach(function (k) {
                        removeWsLockKey(_this, ws, k);
                        if (_this.locks[k]) {
                            _this.unlock({
                                force: true,
                                key: k
                            }, ws);
                        }
                    });
                }
            });
            ws.on('message', function (msg) {
                ijson.parse(msg).then(function (data) {
                    var key = data.key;
                    if (key) {
                        var v = void 0;
                        if (!(v = _this.wsToKeys.get(ws))) {
                            v = [];
                            _this.wsToKeys.set(ws, v);
                        }
                        var index = v.indexOf(key);
                        if (index < 0) {
                            v.push(key);
                        }
                    }
                    if (data.type === 'unlock') {
                        debug(colors.blue(' => broker is attempting to run unlock...'));
                        _this.unlock(data, ws);
                    }
                    else if (data.type === 'lock') {
                        debug(colors.blue(' => broker attempting to get lock...'));
                        _this.lock(data, ws);
                    }
                    else if (data.type === 'lock-received') {
                        _this.bookkeeping[data.key].lockCount++;
                        clearTimeout(_this.timeouts[data.key]);
                        delete _this.timeouts[data.key];
                    }
                    else if (data.type === 'unlock-received') {
                        var key_1 = data.key;
                        clearTimeout(_this.timeouts[key_1]);
                        delete _this.timeouts[key_1];
                        _this.bookkeeping[key_1].unlockCount++;
                        debug('\n', ' => Lock/unlock count (broker), key => ', '"' + key_1 + '"', '\n', util.inspect(_this.bookkeeping[key_1]), '\n');
                    }
                    else if (data.type === 'lock-client-timeout') {
                        var lck = _this.locks[key];
                        var uuid = data.uuid;
                        if (!lck) {
                            console.error(' => Lock must have expired.');
                            return;
                        }
                        var ln = lck.notify.length;
                        for (var i = 0; i < ln; i++) {
                            if (lck.notify[i].uuid === uuid) {
                                lck.notify.splice(i, 1);
                                break;
                            }
                        }
                    }
                    else if (data.type === 'lock-received-rejected') {
                        var lck = _this.locks[key];
                        if (!lck) {
                            console.error(' => Lock must have expired.');
                            return;
                        }
                        _this.rejected[data.uuid] = true;
                        _this.ensureNewLockHolder(lck, data, function (err) {
                            console.log(' => new lock-holder ensured.');
                        });
                    }
                    else if (data.type === 'lock-info-request') {
                        _this.retrieveLockInfo(data, ws);
                    }
                    else {
                        console.error(colors.red.bold(' bad data sent to broker.'));
                        _this.send(ws, {
                            key: data.key,
                            uuid: data.uuid,
                            error: new Error(' => Bad data sent to web socket server =>').stack
                        });
                    }
                }, function (err) {
                    console.error(colors.red.bold(err.stack || err));
                    _this.send(ws, {
                        error: err.stack
                    });
                });
            });
        });
    }
    Broker.create = function (opts, cb) {
        return new Broker(opts).ensure(cb);
    };
    Broker.prototype.sendStatsMessageToAllClients = function () {
        var _this = this;
        var time = Date.now();
        var clients = this.wsToKeys.keys();
        async.mapSeries(clients, function (ws, cb) {
            var keys = _this.wsToKeys.get(ws);
            async.mapSeries(keys, function (k, cb) {
                var lck = _this.locks[k];
                var len = lck ? lck.notify.length : 0;
                _this.send(ws, {
                    type: 'stats',
                    key: k,
                    lockRequestCount: len
                }, function (err) {
                    cb(null, {
                        error: err
                    });
                });
            }, cb);
        }, function (err, results) {
            if (err) {
                throw err;
            }
            results.filter(function (r) {
                return r && r.error;
            }).forEach(function (err) {
                console.error(err.stack || err);
            });
            var diff = Date.now() - time;
            var wait = Math.max(1, 1000 - diff);
            setTimeout(function () {
                _this.sendStatsMessageToAllClients();
            }, wait);
        });
    };
    Broker.prototype.ensureNewLockHolder = function (lck, data, cb) {
        var _this = this;
        var locks = this.locks;
        var notifyList = lck.notify;
        lck.uuid = null;
        lck.pid = null;
        var key = data.key;
        debug('\n', colors.blue.bold(' => Notify list length => '), colors.blue(notifyList.length), '\n');
        clearTimeout(lck.to);
        delete lck.to;
        var obj;
        if (obj = notifyList.shift()) {
            debug(colors.cyan.bold(' => Sending ws client the acquired message.'));
            var ws_1 = obj.ws;
            var ttl = weAreDebugging ? 50000000 : (obj.ttl || this.lockExpiresAfter);
            addWsLockKey(this, ws_1, key);
            lck.uuid = obj.uuid;
            lck.pid = obj.pid;
            lck.to = setTimeout(function () {
                process.emit('warning', ' => Live-Mutex warning, lock object timed out for key => "' + key + '"');
                _this.unlock({
                    key: key,
                    force: true
                });
            }, ttl);
            clearTimeout(this.timeouts[key]);
            delete this.timeouts[key];
            this.timeouts[key] = setTimeout(function () {
                removeWsLockKey(_this, ws_1, key);
                delete _this.timeouts[key];
                var _lck;
                var count;
                if (_lck = locks[key]) {
                    _lck.uuid = undefined;
                    _lck.pid = undefined;
                    count = lck.notify.length;
                }
                else {
                    count = 0;
                }
                if (!_this.rejected[obj.uuid]) {
                    notifyList.push(obj);
                }
                notifyList.forEach(function (obj) {
                    _this.send(obj.ws, {
                        key: data.key,
                        uuid: obj.uuid,
                        type: 'lock',
                        lockRequestCount: count,
                        retry: true
                    });
                });
            }, this.timeoutToFindNewLockholder);
            var count = lck.notify.length;
            this.send(obj.ws, {
                key: data.key,
                uuid: obj.uuid,
                type: 'lock',
                lockRequestCount: count,
                acquired: true
            });
        }
        else {
            delete locks[key];
            debug(colors.red.bold(' => No other connections waiting for lock with key => "' + key + '"' +
                ', so we deleted the lock.'));
        }
    };
    Broker.prototype.retrieveLockInfo = function (data, ws) {
        var locks = this.locks;
        var key = data.key;
        var lck = locks[key];
        var uuid = data.uuid;
        var isLocked = lck && lck.uuid && true;
        var lockholderUUID = isLocked ? lck.uuid : null;
        var lockRequestCount = lck ? lck.notify.length : -1;
        if (isLocked && lockRequestCount > 0) {
            console.error(' => Live-Mutex implementation warning, lock is unlocked but ' +
                'notify array has at least one item, for key => ', key);
        }
        this.send(ws, {
            key: key,
            uuid: uuid,
            lockholderUUID: lockholderUUID,
            isLocked: !!isLocked,
            lockRequestCount: lockRequestCount,
            lockInfo: true,
            type: 'lock-info-response'
        });
    };
    Broker.prototype.lock = function (data, ws) {
        var _this = this;
        var locks = this.locks;
        var key = data.key;
        var lck = locks[key];
        var uuid = data.uuid;
        var pid = data.pid;
        var ttl = weAreDebugging ? 500000000 : (data.ttl || this.lockExpiresAfter);
        var force = data.force;
        this.bookkeeping[key] = this.bookkeeping[key] ||
            {
                rawLockCount: 0,
                rawUnlockCount: 0,
                lockCount: 0,
                unlockCount: 0
            };
        this.bookkeeping[key].rawLockCount++;
        if (lck) {
            var count = lck.notify.length;
            if (lck.uuid) {
                debug(' => Lock exists *and* already has a lockholder; adding ws to list of to be notified.');
                var alreadyAdded = lck.notify.some(function (item) {
                    return String(item.uuid) === String(uuid);
                });
                if (!alreadyAdded) {
                    lck.notify.push({
                        ws: ws,
                        uuid: uuid,
                        pid: pid,
                        ttl: ttl
                    });
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
                lck.to = setTimeout(function () {
                    process.emit('warning', ' => Live-Mutex warning, lock object timed out for key => "' + key + '"');
                    _this.unlock({
                        key: key,
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
            debug(' => Lock does not exist, creating new lock.');
            locks[key] = {
                pid: pid,
                uuid: uuid,
                notify: [],
                key: key,
                to: setTimeout(function () {
                    process.emit('warning', ' => Live-Mutex warning, lock object timed out for key => "' + key + '"');
                    _this.unlock({
                        key: key,
                        force: true
                    });
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
    };
    Broker.prototype.unlock = function (data, ws) {
        var _this = this;
        var locks = this.locks;
        var key = data.key;
        var uuid = data.uuid;
        var _uuid = data._uuid;
        var force = data.force;
        var lck = locks[key];
        this.bookkeeping[key] = this.bookkeeping[key] || {
            rawLockCount: 0,
            rawUnlockCount: 0,
            lockCount: 0,
            unlockCount: 0
        };
        this.bookkeeping[key].rawUnlockCount++;
        var same = true;
        if (_uuid && lck && lck.uuid !== undefined) {
            same = (String(lck.uuid) === String(_uuid));
            if (!same) {
                console.error('! => same is => ', same);
                console.error('! => lck.uuid is => ', lck.uuid);
                console.error('! => unlock._uuid is => ', _uuid);
            }
        }
        if (lck && (same || force)) {
            var count = lck.notify.length;
            clearTimeout(lck.to);
            if (uuid && ws) {
                this.send(ws, {
                    uuid: uuid,
                    key: key,
                    lockRequestCount: count,
                    type: 'unlock',
                    unlocked: true
                });
            }
            this.wsLock.keys().forEach(function (k) {
                var keys = _this.wsLock.get(k);
                if (keys) {
                    var i = keys.indexOf[key];
                    if (i >= 0) {
                        keys.splice(i, 1);
                    }
                }
            });
            this.ensureNewLockHolder(lck, data, function () {
                debug(' => All done notifying.');
            });
        }
        else if (lck) {
            var count = lck.notify.length;
            if (uuid && ws) {
                this.send(ws, {
                    uuid: uuid,
                    key: key,
                    lockRequestCount: count,
                    type: 'unlock',
                    error: ' => You need to pass the correct uuid, or use force.',
                    unlocked: false,
                    retry: true
                });
            }
        }
        else {
            console.error(colors.red.bold(' => Live-Mutex Usage / implementation error => this should not happen => no lock with key => '), colors.red('"' + key + '"'));
            this.wsLock.keys().forEach(function (k) {
                var keys = _this.wsLock.get(k);
                if (keys) {
                    var i = keys.indexOf[key];
                    if (i >= 0) {
                        keys.splice(i, 1);
                    }
                }
            });
            if (ws) {
                process.emit('warning', ' => Live-Mutex warning, => no lock with key => "' + key + '"');
                this.send(ws, {
                    uuid: uuid,
                    key: key,
                    lockRequestCount: 0,
                    type: 'unlock',
                    unlocked: true,
                    error: ' => Live-Mutex warning => no lock with key => "' + key + '"'
                });
            }
        }
    };
    return Broker;
}());
exports.Broker = Broker;
