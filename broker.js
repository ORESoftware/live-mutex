'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var EE = require("events");
var net = require("net");
var util = require("util");
var async = require('async');
var colors = require('colors/safe');
var uuidV4 = require('uuid/v4');
var JSONStream = require('JSONStream');
var debug = require('debug')('live-mutex');
var loginfo = console.log.bind(console, '[live-mutex broker] =>');
var logerr = console.error.bind(console, '[live-mutex broker] =>');
var weAreDebugging = require('./lib/we-are-debugging');
if (weAreDebugging) {
    loginfo('Live-Mutex broker is in debug mode. Timeouts are turned off.');
}
process.on('warning', function (e) {
    console.error(e.stack || e);
});
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
        this.isOpen = false;
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
            var cleanUp = function () {
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
            };
            if (!ws.writable) {
                cleanUp();
                return cb && process.nextTick(cb);
            }
            ws.write(JSON.stringify(data) + '\n', 'utf8', function (err) {
                if (err) {
                    logerr(err.stack || err, '\n');
                    cleanUp();
                }
                cb && cb(null);
            });
        };
        var ee = new EE();
        var onData = function (ws, data) {
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
            }
            else if (data.type === 'lock-client-timeout') {
                var lck = _this.locks[key];
                var uuid = data.uuid;
                if (!lck) {
                    logerr('Lock must have expired.');
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
                    logerr('Lock must have expired.');
                    return;
                }
                _this.rejected[data.uuid] = true;
                _this.ensureNewLockHolder(lck, data);
            }
            else if (data.type === 'lock-info-request') {
                _this.retrieveLockInfo(data, ws);
            }
            else {
                logerr(colors.red.bold("implementation error, bad data sent to broker => \n" + util.inspect(data)));
                _this.send(ws, {
                    key: data.key,
                    uuid: data.uuid,
                    error: 'Malformed data sent to Live-Mutex broker.'
                });
            }
        };
        var firstConnection = true;
        var wss = net.createServer(function (ws) {
            loginfo('client connected.');
            var endWS = function () {
                try {
                    ws.end();
                }
                finally {
                }
            };
            process.once('exit', endWS);
            if (firstConnection) {
                firstConnection = false;
                _this.sendStatsMessageToAllClients();
            }
            ws.once('error', function (err) {
                logerr('client error', err.stack || err, '\n');
            });
            if (!_this.wsToKeys.get(ws)) {
                _this.wsToKeys.set(ws, []);
            }
            ws.once('end', function () {
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
            ws.pipe(JSONStream.parse())
                .on('data', function (v) {
                onData(ws, v);
            })
                .once('error', function (e) {
                this.send(ws, {
                    error: String(e.stack || e)
                }, function () {
                    ws.end();
                });
            });
        });
        wss.on('error', function (err) {
            logerr(err.stack || err);
        });
        setInterval(function () {
            wss.getConnections(function (err, data) {
                err && logerr(err);
                data && logerr('connection information =>', data);
            });
        }, 4000);
        var brokerPromise = null;
        this.ensure = this.start = function (cb) {
            var _this = this;
            if (brokerPromise) {
                return brokerPromise;
            }
            return brokerPromise = new Promise(function (resolve, reject) {
                var to = setTimeout(function () {
                    reject(new Error('Live-Mutex broker, listen action timed out.'));
                }, 3000);
                wss.once('error', reject);
                wss.listen(_this.port, function () {
                    _this.isOpen = true;
                    clearTimeout(to);
                    wss.removeListener('error', reject);
                    resolve(_this);
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
        this.bookkeeping = {};
        this.rejected = {};
        this.timeouts = {};
        this.locks = {};
        this.wsLock = new Map();
        this.wsToKeys = new Map();
        cb && this.ensure(cb);
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
    Broker.prototype.ensureNewLockHolder = function (lck, data) {
        var _this = this;
        var locks = this.locks;
        var notifyList = lck.notify;
        lck.uuid = null;
        lck.pid = null;
        var key = data.key;
        clearTimeout(lck.to);
        delete lck.to;
        var obj;
        if (obj = notifyList.shift()) {
            var ws_1 = obj.ws;
            var ttl = weAreDebugging ? 50000000 : (obj.ttl || this.lockExpiresAfter);
            addWsLockKey(this, ws_1, key);
            lck.uuid = obj.uuid;
            lck.pid = obj.pid;
            lck.to = setTimeout(function () {
                process.emit('warning', 'Live-Mutex warning, lock object timed out for key => "' + key + '"');
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
            key: key, uuid: uuid, lockholderUUID: lockholderUUID,
            lockRequestCount: lockRequestCount,
            isLocked: !!isLocked,
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
                var alreadyAdded = lck.notify.some(function (item) {
                    return String(item.uuid) === String(uuid);
                });
                if (!alreadyAdded) {
                    lck.notify.push({ ws: ws, uuid: uuid, pid: pid, ttl: ttl });
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
                    _this.unlock({ key: key, force: true });
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
                pid: pid,
                uuid: uuid,
                key: key,
                notify: [],
                to: setTimeout(function () {
                    process.emit('warning', ' => Live-Mutex warning, lock object timed out for key => "' + key + '"');
                    _this.unlock({ key: key, force: true });
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
            this.wsLock.forEach(function (v, k) {
                var keys = _this.wsLock.get(k);
                if (keys) {
                    var i = keys.indexOf[key];
                    if (i >= 0) {
                        keys.splice(i, 1);
                    }
                }
            });
            this.ensureNewLockHolder(lck, data);
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
            this.wsLock.forEach(function (v, k) {
                var keys = _this.wsLock.get(k);
                if (keys) {
                    var i = keys.indexOf[key];
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
                    error: ' => Live-Mutex warning => no lock with key [1] => "' + key + '"'
                });
            }
        }
    };
    return Broker;
}());
exports.Broker = Broker;
exports.LvMtxBroker = Broker;
exports.LMBroker = Broker;
exports.default = Broker;
