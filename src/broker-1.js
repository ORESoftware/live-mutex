'use strict';
exports.__esModule = true;
//core
var assert = require("assert");
var net = require("net");
var util = require("util");
//npm
var json_parser_1 = require("./json-parser");
//project
var log = {
    info: console.log.bind(console, ' [live-mutex broker]'),
    error: console.error.bind(console, ' [live-mutex broker]')
};
///////////////////////////////////////////////////////////////////
var we_are_debugging_1 = require("./we-are-debugging");
if (we_are_debugging_1.weAreDebugging) {
    log.error('broker is in debug mode. Timeouts are turned off.');
}
process.setMaxListeners(100);
process.on('warning', function (e) {
    log.error('warning:', e && e.stack || e);
});
///////////////////////////////////////////////////////////////////
var addWsLockKey = function (broker, ws, key) {
    var v;
    if (!(v = broker.wsLock.get(ws))) {
        v = [];
        broker.wsLock.set(ws, v);
    }
    if (v.indexOf(key) < 0) {
        v.push(key);
    }
};
var removeWsLockKey = function (broker, ws, key) {
    var v;
    if (v = broker.wsLock.get(ws)) {
        var i = v.indexOf(key);
        if (i >= 0) {
            v.splice(i, 1);
            return true;
        }
    }
};
var validOptions = [
    'lockExpiresAfter',
    'timeoutToFindNewLockholder',
    'host',
    'port'
];
////////////////////////////////////////////////////////
var Broker = /** @class */ (function () {
    ///////////////////////////////////////////////////////////////
    function Broker($opts, cb) {
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
        this.lockExpiresAfter = we_are_debugging_1.weAreDebugging ? 5000000 : (opts.lockExpiresAfter || 5000);
        this.timeoutToFindNewLockholder = we_are_debugging_1.weAreDebugging ? 5000000 : (opts.timeoutToFindNewLockholder || 4500);
        this.host = opts.host || '127.0.0.1';
        this.port = opts.port || 6970;
        var self = this;
        this.send = function (ws, data, cb) {
            var _this = this;
            var cleanUp = function () {
                var key = data.key;
                if (key) {
                    var isOwnsKey = removeWsLockKey(_this, ws, key);
                    if (isOwnsKey) {
                        self.unlock({
                            key: key,
                            force: true
                        }, ws);
                    }
                }
            };
            if (!ws.writable) {
                process.emit('warning', new Error('socket is not writable 1.'));
                // cleanUp();
                return cb && process.nextTick(cb);
            }
            ws.write(JSON.stringify(data) + '\n', 'utf8', function (err) {
                if (err) {
                    process.emit('warning', new Error('socket is not writable 2.'));
                    process.emit('warning', err);
                    // cleanUp();
                }
                cb && cb(null);
            });
        };
        var onData = function (ws, data) {
            var key = data.key;
            if (key) {
                var v = void 0;
                if (!(v = self.wsToKeys.get(ws))) {
                    v = [];
                    self.wsToKeys.set(ws, v);
                }
                var index = v.indexOf(key);
                if (index < 0) {
                    v.push(key);
                }
            }
            if (data.type === 'unlock') {
                console.log('called unlock 5');
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
                var key_1 = data.key;
                clearTimeout(self.timeouts[key_1]);
                delete self.timeouts[key_1];
                self.bookkeeping[key_1].unlockCount++;
            }
            else if (data.type === 'lock-client-timeout') {
                // if the client times out, we don't want to send them any more messages
                var lck = self.locks[key];
                var uuid = data.uuid;
                if (!lck) {
                    process.emit('warning', new Error("Lock for key \"" + key + "\" has probably expired."));
                    return;
                }
                var ln = lck.notify.length;
                for (var i = 0; i < ln; i++) {
                    if (lck.notify[i].uuid === uuid) {
                        // remove item from notify
                        lck.notify.splice(i, 1);
                        break;
                    }
                }
            }
            else if (data.type === 'lock-received-rejected') {
                var lck = self.locks[key];
                if (!lck) {
                    process.emit('warning', new Error("Lock for key \"" + key + "\" has probably expired."));
                    return;
                }
                self.rejected[data.uuid] = true;
                self.ensureNewLockHolder(lck, data);
            }
            else if (data.type === 'lock-info-request') {
                self.retrieveLockInfo(data, ws);
            }
            else {
                process.emit('warning', new Error("implementation error, bad data sent to broker => " + util.inspect(data)));
                self.send(ws, {
                    key: data.key,
                    uuid: data.uuid,
                    error: 'Malformed data sent to Live-Mutex broker.'
                });
            }
        };
        var connectedClients = new Map();
        var firstConnection = true;
        var wss = net.createServer(function (ws) {
            // process.emit('info', 'client has connected to live-mutex broker.');
            connectedClients.set(ws, true);
            var endWS = function () {
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
                connectedClients["delete"](ws);
            });
            ws.once('end', function () {
                ws.removeAllListeners();
                connectedClients["delete"](ws);
            });
            ws.on('error', function (err) {
                process.emit('warning', new Error('live-mutex client error ' + (err.stack || err)));
            });
            if (!self.wsToKeys.get(ws)) {
                self.wsToKeys.set(ws, []);
            }
            ws.once('end', function () {
                var keys;
                // if (keys = this.wsLock.get(ws)) {
                //   keys.forEach(k => {
                //     removeWsLockKey(this, ws, k);
                //     if (this.locks[k]) {
                //       this.unlock({
                //         force: true,
                //         key: k
                //       }, ws);
                //     }
                //   });
                // }
            });
            ws.pipe(json_parser_1.createParser())
                .on('data', function (v) {
                onData(ws, v);
            })
                .once('error', function (e) {
                self.send(ws, {
                    error: String(e && e.stack || e)
                }, function () {
                    ws.end();
                });
            });
        });
        var callable = true;
        var sigEvent = function (event) {
            return function () {
                if (!callable) {
                    return;
                }
                callable = false;
                process.emit('warning', new Error(event + " event has occurred."));
                connectedClients.forEach(function (v, k, map) {
                    // destroy each connected client
                    k.destroy();
                });
                wss.close(function () {
                    process.exit(1);
                });
            };
        };
        process.on('uncaughtException', function (e) {
            log.error('Uncaught Exception:', e && e.stack || e);
        });
        process.once('exit', sigEvent('exit'));
        process.once('uncaughtException', sigEvent('uncaughtException'));
        process.once('SIGINT', sigEvent('SIGINT'));
        process.once('SIGTERM', sigEvent('SIGTERM'));
        wss.on('error', function (err) {
            process.emit('warning', new Error('live-mutex broker error' + (err.stack || err)));
        });
        var brokerPromise = null;
        this.ensure = this.start = function (cb) {
            if (cb && typeof cb !== 'function') {
                throw new Error('optional argument to ensure/connect must be a function.');
            }
            if (brokerPromise) {
                return brokerPromise.then(function (val) {
                    cb && cb.call(self, null, val);
                    return val;
                }, function (err) {
                    cb && cb.call(self, err);
                    return Promise.reject(err);
                });
            }
            return brokerPromise = new Promise(function (resolve, reject) {
                var to = setTimeout(function () {
                    reject(new Error('Live-Mutex broker error: listening action timed out.'));
                }, 3000);
                wss.once('error', reject);
                wss.listen(self.port, function () {
                    self.isOpen = true;
                    clearTimeout(to);
                    wss.removeListener('error', reject);
                    resolve(self);
                });
            })
                .then(function (val) {
                cb && cb.call(self, null, val);
                return val;
            }, function (err) {
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
    Broker.create = function (opts, cb) {
        return new Broker(opts).ensure(cb);
    };
    Broker.prototype.ensureNewLockHolder = function (lck, data) {
        var locks = this.locks;
        var notifyList = lck.notify;
        // currently there is no lock-holder;
        // before we delete the lock object, let's try to find a new lock-holder
        lck.uuid = null;
        lck.pid = null;
        var key = data.key;
        clearTimeout(lck.to);
        delete lck.to;
        var self = this;
        var obj;
        if (obj = notifyList.shift()) {
            // Sending ws client the "acquired" message
            // set the timeout for the next ws to acquire lock, if not within alloted time, we simple call unlock
            var ws_1 = obj.ws;
            var ttl = we_are_debugging_1.weAreDebugging ? 50000000 : (obj.ttl || this.lockExpiresAfter);
            addWsLockKey(this, ws_1, key);
            var uuid_1 = lck.uuid = obj.uuid;
            lck.pid = obj.pid;
            lck.to = setTimeout(function () {
                // delete locks[key]; => no, this.unlock will take care of that
                process.emit('warning', new Error('Live-Mutex Broker warning, lock object timed out for key => "' + key + '"'));
                // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid comes into the broker
                // we know that it timed out already, and we know not to throw an error when the lock.uuid doesn't match
                lck.lockholderTimeouts[uuid_1] = true;
                self.unlock({
                    key: key,
                    force: true
                });
            }, ttl);
            clearTimeout(this.timeouts[key]);
            delete this.timeouts[key];
            this.timeouts[key] = setTimeout(function () {
                removeWsLockKey(this, ws_1, key);
                delete self.timeouts[key];
                // if this timeout occurs, that is because the first item in the notify list did not receive the
                // acquire lock message, so we push the object back onto the end of notify list and send a reelection message to all
                // if a client receives a reelection message, they will all retry to acquire the lock on this key
                var _lck;
                var count;
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
                notifyList.forEach(function (obj) {
                    self.send(obj.ws, {
                        key: data.key,
                        uuid: obj.uuid,
                        type: 'lock',
                        lockRequestCount: count,
                        reelection: true
                    });
                });
            }, self.timeoutToFindNewLockholder);
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
            // note: only delete lock if no client is remaining to claim it
            // No other connections waiting for lock with key, so we deleted the lock
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
            isLocked: Boolean(isLocked),
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
        var ttl = we_are_debugging_1.weAreDebugging ? 500000000 : (data.ttl || this.lockExpiresAfter);
        var force = data.force;
        var retryCount = data.retryCount;
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
                // Lock exists *and* already has a lockholder; adding ws to list of to be notified
                // if we are retrying, we may attempt to call lock() more than once
                // we don't want to push the same ws object / same uuid combo to array
                var alreadyAdded = lck.notify.some(function (item) {
                    return String(item.uuid) === String(uuid);
                });
                if (!alreadyAdded) {
                    if (retryCount > 0) {
                        lck.notify.unshift({ ws: ws, uuid: uuid, pid: pid, ttl: ttl });
                    }
                    else {
                        lck.notify.push({ ws: ws, uuid: uuid, pid: pid, ttl: ttl });
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
                lck.to = setTimeout(function () {
                    // delete locks[key];  => no, this.unlock will take care of that
                    process.emit('warning', new Error('Live-Mutex Broker warning, lock object timed out for key => "' + key + '"'));
                    // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid might come in to broker
                    // we know that it timed out already, and we do not throw an error then
                    lck.lockholderTimeouts[uuid] = true;
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
            console.log('ttl is 2:', ttl);
            locks[key] = {
                pid: pid,
                uuid: uuid,
                lockholderTimeouts: {},
                key: key,
                notify: [],
                to: setTimeout(function () {
                    // delete locks[key];  => no!, this.unlock will take care of that
                    process.emit('warning', new Error('Live-Mutex warning, lock object timed out for key => "' + key + '"'));
                    // we set lck.lockholderTimeouts[uuid], so that when an unlock request for uuid comes into the broker
                    // we know that it timed out already, and we know not to throw an error when the lock.uuid doesn't match
                    locks[key] && (locks[key].lockholderTimeouts[uuid] = true);
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
        var locks = this.locks;
        var key = data.key;
        var uuid = data.uuid;
        var _uuid = data._uuid;
        var force = data.force;
        var lck = locks[key];
        var self = this;
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
        var same = true;
        if (_uuid && lck && lck.uuid !== undefined) {
            same = (String(lck.uuid) === String(_uuid));
        }
        if (lck && (same || force)) {
            var count = lck.notify.length;
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
            this.wsLock.forEach(function (v, k) {
                var keys = self.wsLock.get(k);
                if (keys) {
                    var i = keys.indexOf(key);
                    if (i >= 0) {
                        keys.splice(i, 1);
                    }
                }
            });
            this.ensureNewLockHolder(lck, data);
        }
        else if (lck) {
            var count = lck.notify.length;
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
            this.wsLock.forEach(function (v, k) {
                var keys = self.wsLock.get(k);
                if (keys) {
                    var i = keys.indexOf[key];
                    if (i >= 0) {
                        keys.splice(i, 1);
                    }
                }
            });
            if (ws) {
                process.emit('warning', new Error('Live-Mutex warning, no lock with key [2] => "' + key + '"'));
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
    };
    return Broker;
}());
exports.Broker = Broker;
// aliases
exports.LvMtxBroker = Broker;
exports.LMBroker = Broker;
exports["default"] = Broker;
