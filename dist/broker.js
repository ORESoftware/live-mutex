'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const net = require("net");
const util = require("util");
const async = require('async');
const colors = require('chalk');
const uuidV4 = require('uuid/v4');
const JSONStream = require('JSONStream');
const loginfo = console.log.bind(console, '[live-mutex broker] =>');
const logerr = console.error.bind(console, '[live-mutex broker] =>');
const weAreDebugging = require('./lib/we-are-debugging');
if (weAreDebugging) {
    logerr('Live-Mutex broker is in debug mode. Timeouts are turned off.');
}
process.setMaxListeners(100);
process.on('warning', function (e) {
    console.error(e.stack || e);
});
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
class Broker {
    constructor($opts, cb) {
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
        const self = this;
        this.send = function (ws, data, cb) {
            let cleanUp = () => {
                const key = data.key;
                if (key) {
                    const isOwnsKey = removeWsLockKey(this, ws, key);
                    if (isOwnsKey) {
                        console.log('unlock was called 4.');
                        self.unlock({
                            key: key,
                            force: true
                        }, ws);
                    }
                }
            };
            if (!ws.writable) {
                console.error('socket is not writable 1.');
                process.emit('warning', new Error('socket is not writable 1.'));
                return cb && process.nextTick(cb);
            }
            ws.write(JSON.stringify(data) + '\n', 'utf8', err => {
                if (err) {
                    console.error('socket is not writable 2.');
                    process.emit('warning', new Error('socket is not writable 2.'));
                    process.emit('warning', err);
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
                console.log('called unlock 5');
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
                const lck = this.locks[key];
                const uuid = data.uuid;
                if (!lck) {
                    process.emit('warning', `Lock for key "${key}" has probably expired.`);
                    return;
                }
                let ln = lck.notify.length;
                for (let i = 0; i < ln; i++) {
                    if (lck.notify[i].uuid === uuid) {
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
                process.emit('warning', `implementation error, bad data sent to broker => ${util.inspect(data)}`);
                this.send(ws, {
                    key: data.key,
                    uuid: data.uuid,
                    error: 'Malformed data sent to Live-Mutex broker.'
                });
            }
        };
        const connectedClients = new Map();
        let firstConnection = true;
        const wss = net.createServer(function (ws) {
            process.emit('info', 'client has connected to live-mutex broker.');
            connectedClients.set(ws, true);
            let endWS = function () {
                try {
                    ws.end();
                }
                finally {
                }
            };
            if (firstConnection) {
                firstConnection = false;
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
                process.emit('warning', new Error('live-mutex client error ' + (err.stack || err)));
            });
            if (!self.wsToKeys.get(ws)) {
                self.wsToKeys.set(ws, []);
            }
            ws.once('end', () => {
                let keys;
            });
            ws.pipe(JSONStream.parse())
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
        let callable = true;
        let sigEvent = function (event) {
            return function () {
                if (!callable) {
                    return;
                }
                callable = false;
                process.emit('warning', `${event} event has occurred.`);
                connectedClients.forEach(function (v, k, map) {
                    k.destroy();
                });
                wss.close(function () {
                    process.exit(1);
                });
            };
        };
        process.on('uncaughtException', function (err) {
            console.error('Uncaught Exception:', err.stack || err);
        });
        process.once('exit', sigEvent('exit'));
        process.once('uncaughtException', sigEvent('uncaughtException'));
        process.once('SIGINT', sigEvent('SIGINT'));
        process.once('SIGTERM', sigEvent('SIGTERM'));
        wss.on('error', function (err) {
            process.emit('warning', new Error('live-mutex broker error' + (err.stack || err)));
        });
        let brokerPromise = null;
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
                let to = setTimeout(function () {
                    reject(new Error('Live-Mutex broker error: listening action timed out.'));
                }, 3000);
                wss.once('error', reject);
                wss.listen(self.port, () => {
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
        this.wsLock = new Map();
        this.wsToKeys = new Map();
        cb && this.ensure(cb);
    }
    static create(opts, cb) {
        return new Broker(opts).ensure(cb);
    }
    ensureNewLockHolder(lck, data) {
        const locks = this.locks;
        const notifyList = lck.notify;
        lck.uuid = null;
        lck.pid = null;
        const key = data.key;
        clearTimeout(lck.to);
        delete lck.to;
        let obj;
        if (obj = notifyList.shift()) {
            let ws = obj.ws;
            let ttl = weAreDebugging ? 50000000 : (obj.ttl || this.lockExpiresAfter);
            addWsLockKey(this, ws, key);
            let uuid = lck.uuid = obj.uuid;
            lck.pid = obj.pid;
            console.log('ttl is 3:', ttl);
            lck.to = setTimeout(() => {
                process.emit('warning', 'Live-Mutex Broker warning, lock object timed out for key => "' + key + '"');
                lck.lockholderTimeouts[uuid] = true;
                console.log('unlock was called 3.');
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
                let _lck;
                let count;
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
            console.log('deleting the lock lulz...');
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
                const alreadyAdded = lck.notify.some(function (item) {
                    return String(item.uuid) === String(uuid);
                });
                if (!alreadyAdded) {
                    if (retryCount > 0) {
                        lck.notify.unshift({ ws, uuid, pid, ttl });
                    }
                    else {
                        lck.notify.push({ ws, uuid, pid, ttl });
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
                console.log('ttl is 1:', ttl);
                lck.to = setTimeout(() => {
                    process.emit('warning', 'Live-Mutex Broker warning, lock object timed out for key => "' + key + '"');
                    lck.lockholderTimeouts[uuid] = true;
                    console.log('unlock was called 1:', ttl);
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
            console.log('ttl is 2:', ttl);
            locks[key] = {
                pid,
                uuid,
                lockholderTimeouts: {},
                key,
                notify: [],
                to: setTimeout(() => {
                    process.emit('warning', 'Live-Mutex warning, lock object timed out for key => "' + key + '"');
                    locks[key] && (locks[key].lockholderTimeouts[uuid] = true);
                    console.log('calling unlock 2.');
                    this.unlock({ key, force: true });
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
    unlock(data, ws) {
        console.log('unlock was called.');
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
        let same = true;
        if (_uuid && lck && lck.uuid !== undefined) {
            same = (String(lck.uuid) === String(_uuid));
        }
        if (lck && (same || force)) {
            const count = lck.notify.length;
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
exports.Broker = Broker;
exports.LvMtxBroker = Broker;
exports.LMBroker = Broker;
exports.default = Broker;
