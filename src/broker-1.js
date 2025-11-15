'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.LMXBroker = exports.LvMtxBroker = exports.Broker1 = exports.validConstructorOptions = exports.log = void 0;
const assert = require("assert");
const net = require("net");
const util = require("util");
const fs = require("fs");
const chalk_1 = require("chalk");
const json_parser_1 = require("./json-parser");
const linked_queue_1 = require("@oresoftware/linked-queue");
const isLocalDev = process.env.oresoftware_local_dev === 'yes';
const shared_internal_1 = require("./shared-internal");
const debugLog = process.argv.indexOf('--lmx-debug') > 0 || process.env.lmx_debug === 'yes';
exports.log = {
    info: console.log.bind(console, chalk_1.default.gray.bold('lmx broker info:')),
    error: console.error.bind(console, chalk_1.default.red.bold('lmx broker error:')),
    warn: console.error.bind(console, chalk_1.default.yellow.bold('lmx broker warning:')),
    debug(...args) {
        if (debugLog) {
            let newTime = Date.now();
            let elapsed = newTime - shared_internal_1.forDebugging.previousTime;
            shared_internal_1.forDebugging.previousTime = newTime;
            console.log(chalk_1.default.yellow.bold('lmx broker debugging:'), 'elapsed millis:', `(${elapsed})`, ...args);
        }
    }
};
const we_are_debugging_1 = require("./we-are-debugging");
const events_1 = require("events");
const path = require("path");
const shared_internal_2 = require("./shared-internal");
const compare_versions_1 = require("./compare-versions");
const shared_internal_3 = require("./shared-internal");
if (we_are_debugging_1.weAreDebugging) {
    exports.log.error('Broker is in debug mode. Timeouts are turned off.');
}
const brokerPackage = require('../package.json');
if (!(brokerPackage.version && typeof brokerPackage.version === 'string')) {
    throw new Error('Broker NPM package did not have a top-level field that is a string.');
}
process.on('uncaughtException', (e) => {
    if (process.env.lmx_log_errors !== 'nope') {
        exports.log.error('Uncaught Exception event occurred in Broker process:', (0, shared_internal_2.inspectError)(e));
    }
});
process.on('warning', (e) => {
    if (process.env.lmx_log_errors !== 'nope') {
        exports.log.debug('warning:', (0, shared_internal_2.inspectError)(e));
    }
});
exports.validConstructorOptions = {
    lockExpiresAfter: 'integer in millis',
    timeoutToFindNewLockholder: 'integer in millis',
    host: 'string',
    port: 'integer',
    noDelay: 'boolean',
    udsPath: 'string',
    noListen: 'boolean'
};
class Broker1 {
    constructor(o, cb) {
        this.locks = new Map();
        this.emitter = new events_1.EventEmitter();
        this.noDelay = true;
        this.socketFile = '';
        this.lockCounts = 0;
        this.connectedClients = new Set();
        this.registeredListeners = {};
        this.isOpen = false;
        const opts = this.opts = o || {};
        assert.strict(typeof opts === 'object', 'Options argument must be an object.');
        for (const k of Object.keys(opts)) {
            if (!exports.validConstructorOptions[k]) {
                throw new Error((0, shared_internal_3.joinToStr)('An option passed to lmx broker constructor', `is not a recognized option => "${k}", valid options are: ${util.inspect(exports.validConstructorOptions)}.`));
            }
        }
        if (opts['lockExpiresAfter']) {
            assert.strict(Number.isInteger(opts.lockExpiresAfter), 'lmx broker: "expiresAfter" option needs to be an integer (milliseconds)');
            assert.strict(opts.lockExpiresAfter > 20 && opts.lockExpiresAfter < 4000000, 'lmx broker: "expiresAfter" is not in range (20 to 4000000 ms).');
        }
        if (opts['timeoutToFindNewLockholder']) {
            assert.strict(Number.isInteger(opts.timeoutToFindNewLockholder), 'lmx broker: "timeoutToFindNewLockholder" option needs to be an integer (milliseconds)');
            assert.strict(opts.timeoutToFindNewLockholder > 20 && opts.timeoutToFindNewLockholder < 4000000, 'lmx broker: "timeoutToFindNewLockholder" is not in range (20 to 4000000 ms).');
        }
        if (opts['host']) {
            assert.strict(typeof opts.host === 'string', ' => "host" option needs to be a string.');
        }
        if (opts['port']) {
            assert.strict(Number.isInteger(opts.port), 'lmx broker: "port" option needs to be an integer => ' + opts.port);
            assert.strict(opts.port > 1024 && opts.port < 49152, 'lmx broker: "port" integer needs to be in range (1025-49151).');
        }
        if ('noDelay' in opts && opts['noDelay'] !== undefined) {
            assert.strict(typeof opts.noDelay === 'boolean', 'lmx broker: "noDelay" option needs to be an integer => ' + opts.noDelay);
            this.noDelay = opts.noDelay;
        }
        this.lockExpiresAfter = we_are_debugging_1.weAreDebugging ? 5000000 : (opts.lockExpiresAfter || 5000);
        this.timeoutToFindNewLockholder = we_are_debugging_1.weAreDebugging ? 5000000 : (opts.timeoutToFindNewLockholder || 4500);
        this.host = opts.host || '127.0.0.1';
        this.port = opts.port || 6970;
        this.noListen = opts.noListen === true;
        if ('udsPath' in opts && opts['udsPath'] !== undefined) {
            assert.strict(typeof opts.udsPath === 'string', 'lmx broker "udsPath" option must be a string.');
            assert.strict(path.isAbsolute(path.resolve(opts.udsPath)), 'lmx broker "udsPath" option must be an absolute path.');
            this.socketFile = path.resolve(opts.udsPath);
        }
        const self = this;
        this.emitter.on('warning', function () {
            if (self.emitter.listenerCount('warning') < 2) {
                exports.log.warn('No "warning" event handlers attached by end-user to the broker emitter, therefore logging these errors from library:');
                exports.log.warn(...arguments);
                exports.log.warn('Add a "warning" event listener to the lmx broker emitter to get rid of this message.');
            }
        });
        this.send = (ws, data, cb) => {
            if (!ws.writable) {
                this.emitter.emit('warning', 'socket is not writable [1].');
                return cb && process.nextTick(cb);
            }
            ws.write(JSON.stringify(data) + '\n', 'utf8', (err) => {
                if (err) {
                    this.emitter.emit('warning', 'socket is not writable [2].');
                    this.emitter.emit('warning', err);
                }
                cb && process.nextTick(cb);
            });
        };
        const onData = (ws, data) => {
            if (data.type === 'version-mismatch-confirmed') {
                clearTimeout(ws.destroyTimeout);
                ws.destroy();
                return;
            }
            if (ws.lmxClosed) {
                return;
            }
            if (data.type === 'simulate-version-mismatch') {
                return self.onVersion({ value: '0.0.1' }, ws);
            }
            if (data.type === 'end-connection-from-broker-for-testing-purposes') {
                return self.abruptlyEndConnection(ws);
            }
            if (data.type === 'destroy-connection-from-broker-for-testing-purposes') {
                return self.abruptlyDestroyConnection(ws);
            }
            const key = data.key;
            if (data.ttl === null) {
                data.ttl = Infinity;
            }
            if (data.inspectCommand) {
                return self.inspect(data, ws);
            }
            if (data.type === 'version') {
                return self.onVersion(data, ws);
            }
            if (data.type === 'ls') {
                return self.ls(data, ws);
            }
            if (data.type === 'unlock') {
                return self.unlock(data, ws);
            }
            if (data.type === 'lock') {
                return self.lock(data, ws);
            }
            if (data.type === 'increment-readers') {
                return self.incrementReaders(data, ws);
            }
            if (data.type === 'decrement-readers') {
                return self.decrementReaders(data, ws);
            }
            if (data.type === 'register-write-flag-check') {
                return self.registerWriteFlagCheck(data, ws);
            }
            if (data.type === 'register-write-flag-and-readers-check') {
                return self.registerWriteFlagAndReadersCheck(data, ws);
            }
            if (data.type === 'set-write-flag-false-and-broadcast') {
                return self.setWriteFlagToFalseAndBroadcast(data, ws);
            }
            if (data.type === 'lock-received') {
                clearTimeout(self.timeouts[data.key]);
                return delete self.timeouts[data.key];
            }
            if (data.type === 'lock-client-timeout' || data.type === 'lock-client-error') {
                const lck = self.locks.get(key);
                const uuid = data.uuid;
                if (!lck) {
                    this.emitter.emit('warning', `Lock for key "${key}" has probably expired.`);
                    return;
                }
                return lck.notify.remove(uuid);
            }
            if (data.type === 'lock-received-rejected') {
                const lck = self.locks.get(key);
                if (!lck) {
                    this.emitter.emit('warning', `Lock for key "${key}" has probably expired.`);
                    return;
                }
                self.rejected[data.uuid] = true;
                return self.ensureNewLockHolder(lck, data);
            }
            if (data.type === 'lock-info-request') {
                return self.retrieveLockInfo(data, ws);
            }
            if (data.type === 'ping') {
                return self.ping(data, ws);
            }
            if (data.type === 'system-stats-request') {
                return self.getSystemStats(data, ws);
            }
            this.emitter.emit('warning', `implementation error, bad data sent to broker => ${util.inspect(data)}`);
            self.send(ws, {
                key: data.key,
                uuid: data.uuid,
                error: 'Malformed data sent to Live-Mutex broker.'
            });
        };
        const wss = this.wss = net.createServer({}, (ws) => {
            this.connectedClients.add(ws);
            if (self.noDelay) {
                ws.setNoDelay(true);
            }
            if (!self.wsToKeys.get(ws)) {
                self.wsToKeys.set(ws, {});
            }
            let endWS = function () {
                try {
                    ws.destroy();
                }
                finally {
                }
            };
            ws.once('disconnect', () => {
                this.cleanupConnection(ws);
                ws.destroy();
                ws.removeAllListeners();
            });
            ws.once('end', () => {
                this.cleanupConnection(ws);
                ws.destroy();
                ws.removeAllListeners();
            });
            ws.once('error', (err) => {
                this.emitter.emit('warning', 'lmx client error: ' + (0, shared_internal_2.inspectError)(err));
                this.cleanupConnection(ws);
                ws.destroy();
                ws.removeAllListeners();
            });
            ws.pipe((0, json_parser_1.createParser)())
                .on('data', (v) => {
                onData(ws, v);
            })
                .once('error', (e) => {
                self.send(ws, {
                    error: (0, shared_internal_2.inspectError)(e)
                }, () => {
                    ws.end();
                });
            });
        });
        let sigEventCallable = true;
        const handleShutdown = (event) => {
            if (!sigEventCallable) {
                return;
            }
            sigEventCallable = false;
            this.emitter.emit('warning', `"${event}" event has occurred.`);
            try {
                if (this.socketFile) {
                    fs.unlinkSync(this.socketFile);
                    exports.log.info('socket file unlinked:', this.socketFile);
                }
            }
            catch (err) {
            }
            for (const c of this.connectedClients) {
                c.destroy();
            }
            wss.close(function () {
                process.exit(1);
            });
        };
        process.once('exit', () => handleShutdown('exit'));
        process.once('SIGINT', () => handleShutdown('SIGINT'));
        process.once('SIGTERM', () => handleShutdown('SIGTERM'));
        wss.on('error', (err) => {
            this.emitter.emit('warning', 'lmx broker error' + (0, shared_internal_2.inspectError)(err));
        });
        let brokerPromise;
        this.ensure = this.start = (cb) => {
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
                }, (err) => {
                    cb && cb.call(self, err, {});
                    return Promise.reject(err);
                });
            }
            const onResolve = (val) => {
                cb && cb.call(self, null, val);
                return val;
            };
            const onRejected = (err) => {
                cb && cb.call(self, err, {});
                return Promise.reject(err);
            };
            if (this.noListen) {
                return brokerPromise =
                    Promise.resolve(this)
                        .then(onResolve)
                        .catch(onRejected);
            }
            return brokerPromise = new Promise((resolve, reject) => {
                let to = setTimeout(function () {
                    reject('lmx broker error: listening action timed out.');
                }, 3000);
                wss.once('error', reject);
                const listenCallback = () => {
                    if (self.socketFile) {
                        try {
                            fs.chmodSync(self.socketFile, '777');
                        }
                        catch (e) {
                            exports.log.error(e);
                        }
                    }
                    self.isOpen = true;
                    clearTimeout(to);
                    wss.removeListener('error', reject);
                    resolve(self);
                };
                if (self.socketFile) {
                    wss.listen(self.socketFile, listenCallback);
                }
                else {
                    wss.listen(self.port, self.host, listenCallback);
                }
            })
                .then(onResolve, onRejected);
        };
        this.rejected = {};
        this.timeouts = {};
        this.wsToUUIDs = new Map();
        this.wsToKeys = new Map();
        cb && this.ensure(cb);
    }
    static create(opts) {
        return new Broker1(opts);
    }
    emit(...args) {
        exports.log.warn('warning:', 'use b.emitter.emit() instead of b.emit()');
        return this.emitter.emit.apply(this.emitter, args);
    }
    on(...args) {
        exports.log.warn('warning:', 'use c.emitter.on() instead of c.on()');
        return this.emitter.on.apply(this.emitter, args);
    }
    once(...args) {
        exports.log.warn('warning:', 'use c.emitter.once() instead of c.once()');
        return this.emitter.once.apply(this.emitter, args);
    }
    ping(data, ws) {
        const uuid = data.uuid;
        const timestamp = data.timestamp || Date.now();
        this.send(ws, {
            uuid: uuid,
            type: 'pong',
            timestamp: timestamp,
            serverTimestamp: Date.now(),
            ping: true
        });
    }
    getSystemStats(data, ws) {
        const uuid = data.uuid;
        let pendingRequests = 0;
        this.locks.forEach(lock => {
            pendingRequests += lock.notify.length || 0;
        });
        const stats = {
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            connectedClients: this.connectedClients.size,
            totalLocks: this.locks.size,
            pendingRequests: pendingRequests,
            activeTimeouts: Object.keys(this.timeouts).length,
            pid: process.pid
        };
        this.send(ws, {
            uuid: uuid,
            type: 'system-stats-response',
            stats: stats
        });
    }
    close(cb) {
        for (const key of Object.keys(this.timeouts)) {
            clearTimeout(this.timeouts[key]);
            delete this.timeouts[key];
        }
        for (const [key, lockObj] of this.locks) {
            for (const lockholder of lockObj.lockholders.values()) {
                if (lockholder.timer) {
                    clearTimeout(lockholder.timer);
                    lockholder.timer = null;
                }
            }
        }
        for (const client of this.connectedClients) {
            try {
                client.destroy();
            }
            catch (err) {
            }
        }
        this.connectedClients.clear();
        this.wss.close(cb);
    }
    getListeningInterface() {
        return this.socketFile || this.port;
    }
    getVersion() {
        return brokerPackage.version;
    }
    getPort() {
        return this.port;
    }
    getHost() {
        return this.host;
    }
    onWarning(callback) {
        this.emitter.on('warning', callback);
    }
    abruptlyDestroyConnection(ws) {
        exports.log.error('Connection will be destroyed.');
        ws.destroy();
        ws.removeAllListeners();
    }
    abruptlyEndConnection(ws) {
        exports.log.error('Connection will be ended.');
        ws.end();
        ws.removeAllListeners();
    }
    onVersion(data, ws) {
        const clientVersion = data.value;
        const brokerVersion = brokerPackage.version;
        try {
            (0, compare_versions_1.compareVersions)(clientVersion, brokerVersion);
        }
        catch (err) {
            this.cleanupConnection(ws);
            const errMessage = `Client version is not compatable with broker,` +
                ` client version: '${clientVersion}', broker version: '${brokerVersion}'.`;
            exports.log.error(err);
            exports.log.error(errMessage);
            this.emitter.emit('error', errMessage);
            this.send(ws, { type: 'version-mismatch', versions: { clientVersion, brokerVersion } });
            ws.destroyTimeout = setTimeout(() => {
                try {
                    ws.destroy();
                }
                finally {
                    ws.removeAllListeners();
                }
            }, 2000);
        }
    }
    cleanupConnection(ws) {
        if (ws.lmxClosed === true) {
            return;
        }
        ws.lmxClosed = true;
        this.connectedClients.delete(ws);
        const wsKeys = this.wsToKeys.get(ws);
        this.wsToKeys.delete(ws);
        const uuids = Object.keys(this.wsToUUIDs.get(ws) || {});
        this.wsToUUIDs.delete(ws);
        if (wsKeys) {
            for (const key of Object.keys(wsKeys)) {
                if (this.timeouts[key]) {
                    clearTimeout(this.timeouts[key]);
                    delete this.timeouts[key];
                }
            }
        }
        for (let [k, lockObj] of this.locks) {
            const notify = lockObj.notify;
            for (const uuid of Object.keys(uuids)) {
                notify.remove(uuid);
            }
            for (const lockholder of lockObj.lockholders.values()) {
                if (lockholder.ws === ws && lockholder.timer) {
                    clearTimeout(lockholder.timer);
                    lockholder.timer = null;
                }
            }
            if (lockObj.isViaShell !== true) {
                this.unlock({ force: true, key: k, from: 'client socket closed/ended/errored' }, ws);
            }
            else if (!lockObj.keepLocksAfterDeath) {
                this.unlock({ force: true, key: k, from: 'client socket closed/ended/errored' }, ws);
            }
        }
    }
    ls(data, ws) {
        return this.send(ws, { ls_result: Object.keys(this.locks), uuid: data.uuid });
    }
    broadcast(data, ws) {
        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];
        exports.log.debug('broadcast: key:', key, 'queued listeners:', v.length);
        let processed = 0;
        while (v.length > 0) {
            let p = v.pop();
            if (p && p.fn) {
                exports.log.debug('broadcast: executing queued function for key:', key, 'listener', processed + 1, 'of', v.length + processed + 1);
                p.fn();
                processed++;
            }
            if (p && p.ws) {
                this.send(p.ws, {
                    key: data.key,
                    uuid: p.uuid,
                    type: 'broadcast-result'
                });
            }
        }
        exports.log.debug('broadcast: processed', processed, 'listeners for key:', key);
        if (ws) {
            this.send(ws, {
                key: data.key,
                uuid: uuid,
                type: 'broadcast-success'
            });
        }
    }
    incrementReaders(data, ws) {
        const key = data.key;
        const uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        let lck = this.locks.get(key);
        exports.log.debug('incrementReaders: key:', key, 'current readers:', lck.readers);
        lck.readers++;
        exports.log.debug('incrementReaders: key:', key, 'new readers count:', lck.readers);
        this.send(ws, {
            key,
            uuid,
            type: 'increment-readers-success'
        });
    }
    setWriteFlagToFalseAndBroadcast(data, ws) {
        const key = data.key;
        const uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        let lck = this.locks.get(key);
        exports.log.debug('setWriteFlagToFalseAndBroadcast: key:', key, 'uuid:', uuid, 'current writerFlag:', lck.writerFlag, 'readers:', lck.readers, 'queued listeners:', this.registeredListeners[key]?.length || 0);
        lck.writerFlag = false;
        exports.log.debug('setWriteFlagToFalseAndBroadcast: writer flag set to false, broadcasting to', this.registeredListeners[key]?.length || 0, 'queued listeners');
        this.broadcast({ key }, null);
        exports.log.debug('setWriteFlagToFalseAndBroadcast: sending success response for key:', key, 'uuid:', uuid);
        this.send(ws, { uuid, key, type: 'write-flag-false-and-broadcast-success' });
        exports.log.debug('setWriteFlagToFalseAndBroadcast: success response sent for key:', key, 'uuid:', uuid);
    }
    decrementReaders(data, ws) {
        const key = data.key;
        const uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        let lck = this.locks.get(key);
        exports.log.debug('decrementReaders: key:', key, 'current readers:', lck.readers);
        const r = lck.readers = Math.max(0, --lck.readers);
        exports.log.debug('decrementReaders: key:', key, 'new readers count:', r);
        if (r < 1) {
            exports.log.debug('decrementReaders: readers are zero, broadcasting to', this.registeredListeners[key]?.length || 0, 'queued listeners');
            this.broadcast({ key }, null);
        }
        exports.log.debug('decrementReaders: sending success response for key:', key, 'uuid:', uuid);
        this.send(ws, {
            key,
            uuid,
            type: 'decrement-readers-success'
        });
        exports.log.debug('decrementReaders: success response sent for key:', key, 'uuid:', uuid);
    }
    registerWriteFlagAndReadersCheck(data, ws) {
        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        let lck = this.locks.get(key);
        const readersCount = lck && lck.readers || 0;
        const writerFlag = lck.writerFlag || false;
        exports.log.debug('registerWriteFlagAndReadersCheck: key:', key, 'writerFlag:', writerFlag, 'readersCount:', readersCount);
        if (writerFlag || readersCount > 1) {
            exports.log.debug('registerWriteFlagAndReadersCheck: queuing write request, current queue length:', v.length);
            return v.push({
                ws, key, uuid, fn: () => {
                    exports.log.debug('registerWriteFlagAndReadersCheck: delayed setting writer flag to true for key:', key);
                    lck.writerFlag = true;
                }
            });
        }
        exports.log.debug('registerWriteFlagAndReadersCheck: setting writer flag to true immediately for key:', key);
        lck.writerFlag = true;
        this.send(ws, {
            readersCount,
            writerFlag,
            key,
            uuid,
            type: 'register-write-flag-and-readers-check-success'
        });
    }
    getDefaultLockObject(key, keepLocksAfterDeath, max) {
        return {
            readers: 0,
            max: max || 1,
            lockholders: new Map(),
            lockholdersAllReleased: {},
            keepLocksAfterDeath,
            lockholderTimeouts: {},
            key,
            notify: new linked_queue_1.LinkedQueue(),
            writerFlag: false,
            timestampEmptied: null
        };
    }
    registerWriteFlagCheck(data, ws) {
        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        const lck = this.locks.get(key);
        const readersCount = lck.readers || 0;
        const writerFlag = lck.writerFlag || false;
        exports.log.debug('registerWriteFlagCheck: key:', key, 'writerFlag:', writerFlag, 'readersCount:', readersCount, 'current queue length:', v.length);
        if (writerFlag) {
            exports.log.debug('registerWriteFlagCheck: writer flag is set, queuing read request for key:', key);
            v.push({
                ws, key, uuid, fn: () => {
                    exports.log.debug('registerWriteFlagCheck: delayed incrementing readers for key:', key, 'current readers:', lck.readers);
                    lck.readers++;
                    exports.log.debug('registerWriteFlagCheck: readers incremented to:', lck.readers, 'sending success response');
                    this.send(ws, {
                        writerFlag: false,
                        readersCount: lck.readers,
                        key,
                        uuid,
                        type: 'register-write-flag-success'
                    });
                }
            });
            exports.log.debug('registerWriteFlagCheck: sending queued response for key:', key);
            this.send(ws, {
                writerFlag: true,
                readersCount: readersCount,
                key,
                uuid,
                type: 'register-write-flag-check-queued'
            });
            return;
        }
        exports.log.debug('registerWriteFlagCheck: no writer flag, allowing read to proceed for key:', key, 'current readers:', lck.readers);
        this.send(ws, {
            writerFlag,
            readersCount,
            key,
            uuid,
            type: 'register-write-flag-success'
        });
    }
    inspect(data, ws) {
        if (typeof data.inspectCommand !== 'string') {
            return this.send(ws, { error: 'inspectCommand was not a string' });
        }
        switch (data.inspectCommand) {
            case 'lockcount':
            case 'lock-count':
            case 'lock_count':
                return this.send(ws, { inspectResult: 5 });
            case 'clientcount':
            case 'client-count':
            case 'client_count':
                return this.send(ws, { inspectResult: 17 });
            default:
                return this.send(ws, { inspectResult: 25 });
        }
    }
    grantLock(lck, ws, uuid, pid, ttl, key) {
        if (ttl !== Infinity) {
            ttl = we_are_debugging_1.weAreDebugging ? 50000000 : (ttl || this.lockExpiresAfter);
        }
        if (!this.wsToKeys.get(ws)) {
            this.wsToKeys.set(ws, {});
        }
        this.wsToKeys.get(ws)[key] = true;
        let timer = null;
        if (ttl !== Infinity) {
            timer = setTimeout(() => {
                this.emitter.emit('warning', `lmx broker warning, lock holder timed out after ${ttl}ms for key => "${key}", uuid => "${uuid}"`);
                if (this.locks.has(key)) {
                    const lock = this.locks.get(key);
                    lock.lockholderTimeouts[uuid] = true;
                    const hadHolder = lock.lockholders.delete(uuid);
                    if (hadHolder) {
                        this.ensureNewLockHolder(lock, { key, _uuid: uuid });
                    }
                }
            }, ttl);
        }
        lck.lockholders.set(uuid, { pid: pid, uuid, ws, timer });
    }
    ensureNewLockHolder(lck, data) {
        const locks = this.locks;
        const notifyList = lck.notify;
        if (data._uuid) {
            const lockholder = lck.lockholders.get(data._uuid);
            if (lockholder && lockholder.timer) {
                clearTimeout(lockholder.timer);
            }
            lck.lockholders.delete(data._uuid);
        }
        lck.keepLocksAfterDeath = null;
        const key = data.key;
        const self = this;
        const count = lck.lockholders.size;
        if (count < 1 && notifyList.length < 1) {
            lck.timestampEmptied = Date.now();
            return;
        }
        while (notifyList.length > 0) {
            if (lck.lockholders.size >= lck.max) {
                break;
            }
            let lqValue;
            let n = null;
            while (lqValue = notifyList.dequeue()) {
                if (linked_queue_1.IsVoid.check(lqValue[0])) {
                    break;
                }
                n = lqValue[1];
                if (n && n.ws && n.ws.writable) {
                    break;
                }
            }
            if (!n) {
                break;
            }
            if (lck.lockholders.size >= lck.max) {
                notifyList.enqueue(n.uuid, n);
                break;
            }
            const ws = n.ws;
            const ttl = n.ttl;
            const uuid = n.uuid;
            this.grantLock(lck, ws, uuid, n.pid, ttl, key);
            lck.keepLocksAfterDeath = n.keepLocksAfterDeath || false;
            const ln = lck.notify.length;
            this.send(n.ws, {
                readersCount: lck.readers,
                key: data.key,
                uuid: n.uuid,
                type: 'lock',
                lockRequestCount: ln,
                acquired: true
            });
            if (this.timeouts[key]) {
                clearTimeout(this.timeouts[key]);
                delete this.timeouts[key];
            }
            this.timeouts[key] = setTimeout(() => {
                try {
                    delete this.wsToKeys.get(ws)[key];
                }
                catch (err) {
                }
                delete self.timeouts[key];
                this.emitter.emit('warning', `Re-election occurring for key: "${key}"`);
                if (locks.has(key)) {
                    const lckTemp = locks.get(key);
                    const hadHolder = lckTemp.lockholders.delete(uuid);
                    const ln = lckTemp.notify.length;
                    const notifyList = lckTemp.notify;
                    if (hadHolder && !self.rejected[uuid]) {
                        const lockholder = lckTemp.lockholders.get(uuid);
                        if (!lockholder && !notifyList.contains(uuid)) {
                            notifyList.deq(5).forEach((lqv) => {
                                let obj;
                                if (Array.isArray(lqv) && !linked_queue_1.IsVoid.check(lqv[0])) {
                                    obj = lqv[1];
                                }
                                else if (lqv && typeof lqv === 'object' && 'value' in lqv) {
                                    obj = lqv.value;
                                }
                                else {
                                    return;
                                }
                                self.send(obj.ws, {
                                    key: data.key,
                                    uuid: obj.uuid,
                                    type: 'lock',
                                    lockRequestCount: ln,
                                    reelection: true
                                });
                            });
                        }
                    }
                    notifyList.deq(5).forEach((lqv) => {
                        let obj;
                        if (Array.isArray(lqv) && !linked_queue_1.IsVoid.check(lqv[0])) {
                            obj = lqv[1];
                        }
                        else if (lqv && typeof lqv === 'object' && 'value' in lqv) {
                            obj = lqv.value;
                        }
                        else {
                            return;
                        }
                        self.send(obj.ws, {
                            key: data.key,
                            uuid: obj.uuid,
                            type: 'lock',
                            lockRequestCount: ln,
                            reelection: true
                        });
                    });
                }
            }, self.timeoutToFindNewLockholder);
        }
    }
    retrieveLockInfo(data, ws) {
        const key = data.key;
        const lck = this.locks.get(key);
        const uuid = data.uuid;
        const lockholderUUIDs = Object.keys(lck || {});
        const isLocked = lockholderUUIDs.length > 0;
        const lockRequestCount = lck ? lck.notify.length : null;
        if (isLocked && lockRequestCount > 0) {
            this.emitter.emit('warning', 'lmx implementation warning, lock is unlocked but ' +
                'notify array has at least one item, for key => ' + key);
        }
        this.send(ws, {
            key, uuid, lockholderUUIDs,
            lockRequestCount,
            isLocked: Boolean(isLocked),
            lockInfo: true,
            type: 'lock-info-response'
        });
    }
    cleanUpLocks() {
        this.lockCounts = 0;
        const now = Date.now();
        this.locks.forEach((v, k) => {
            if (!v.timestampEmptied) {
                return;
            }
            if (now - v.timestampEmptied < 2000) {
                return;
            }
            const notify = v.notify.getLength();
            const count = v.lockholders.size;
            if (count < 1 && notify < 1) {
                exports.log.info(chalk_1.default.yellow('deleted lock object with key:'), k);
                this.locks.delete(k);
            }
        });
    }
    lock(data, ws) {
        const key = data.key;
        const keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
        const lck = this.locks.get(key);
        if (lck) {
            lck.timestampEmptied = null;
        }
        if (++this.lockCounts > 3) {
            this.cleanUpLocks();
        }
        const uuid = data.uuid;
        const pid = data.pid;
        const max = data.max;
        const beginRead = data.rwStatus === shared_internal_2.RWStatus.BeginRead;
        const endRead = data.rwStatus === shared_internal_2.RWStatus.EndRead;
        const force = data.force;
        const retryCount = data.retryCount;
        if (lck) {
            const count = lck.lockholders.size;
            exports.log.debug(data.rwStatus, 'is contending for lock on key:', key, 'there is/are', count, 'lockholders.');
        }
        let ttl = data.ttl;
        if (ttl !== Infinity) {
            ttl = we_are_debugging_1.weAreDebugging ? 500000000 : (data.ttl || this.lockExpiresAfter);
        }
        if (uuid) {
            if (!this.wsToUUIDs.has(ws)) {
                this.wsToUUIDs.set(ws, {});
            }
            this.wsToUUIDs.get(ws)[uuid] = true;
        }
        if (!this.wsToKeys.has(ws)) {
            this.wsToKeys.set(ws, {});
        }
        if (lck) {
            if (Number.isInteger(max)) {
                lck.max = max;
            }
            const ln = lck.notify.length;
            const count = lck.lockholders.size;
            if (count >= lck.max) {
                if (count > lck.max) {
                    exports.log.warn(`Semaphore limit exceeded: ${count} lock holders exceeds max of ${lck.max} for key "${key}"`);
                }
                if (force) {
                    lck.notify.remove(uuid);
                    lck.notify.addToFront(uuid, { ws, uuid, pid, ttl, keepLocksAfterDeath });
                }
                else {
                    const alreadyAddedResult = lck.notify.get(uuid);
                    const alreadyAdded = alreadyAddedResult && !linked_queue_1.IsVoid.check(alreadyAddedResult[0]);
                    if (!alreadyAdded) {
                        if (retryCount > 0) {
                            lck.notify.addToFront(uuid, { ws, uuid, pid, ttl, keepLocksAfterDeath });
                        }
                        else {
                            lck.notify.enqueue(uuid, { ws, uuid, pid, ttl, keepLocksAfterDeath });
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
                return;
            }
            exports.log.debug(data.rwStatus, 'has acquired lock on key:', key);
            if (beginRead) {
                lck.readers++;
            }
            if (endRead) {
                lck.readers = Math.max(0, --lck.readers);
            }
            this.grantLock(lck, ws, uuid, pid, ttl, key);
            this.send(ws, {
                readersCount: lck.readers,
                uuid: uuid,
                key: key,
                lockRequestCount: ln,
                type: 'lock',
                acquired: true
            });
            return;
        }
        exports.log.debug(data.rwStatus, 'has acquired lock on key:', key);
        if (!this.wsToKeys.has(ws)) {
            this.wsToKeys.set(ws, {});
        }
        this.wsToKeys.get(ws)[key] = true;
        const lckTemp = this.getDefaultLockObject(key, keepLocksAfterDeath, max);
        this.locks.set(key, lckTemp);
        if (beginRead) {
            lckTemp.readers++;
        }
        if (endRead) {
            lckTemp.readers = Math.max(0, --lckTemp.readers);
        }
        this.grantLock(lckTemp, ws, uuid, pid, ttl, key);
        this.send(ws, {
            readersCount: lckTemp.readers,
            uuid: uuid,
            lockRequestCount: 0,
            key: key,
            type: 'lock',
            acquired: true
        });
    }
    unlock(data, ws) {
        const key = data.key;
        const uuid = data.uuid;
        const _uuid = data._uuid;
        const force = data.force;
        const lck = this.locks.get(key);
        const keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
        exports.log.debug('unlock: received unlock request for key:', key, 'uuid:', uuid, '_uuid:', _uuid, 'force:', force, 'has lock:', !!lck);
        if (ws && keepLocksAfterDeath !== true) {
            try {
                delete this.wsToKeys.get(ws)[key];
            }
            catch (err) {
            }
        }
        try {
            delete this.wsToUUIDs.get(ws)[_uuid];
        }
        catch (err) {
        }
        let same = null;
        if (_uuid && lck) {
            same = lck.lockholders.has(_uuid);
            exports.log.debug('same is:', same);
        }
        else if (lck) {
            exports.log.debug('no _uuid was passed to unlock');
        }
        if (lck && (same || force)) {
            const ln = lck.notify.length;
            const lockholder = lck.lockholders.get(_uuid);
            if (lockholder && lockholder.timer) {
                clearTimeout(lockholder.timer);
            }
            lck.lockholders.delete(_uuid);
            if (force) {
                if (_uuid && lck.max > 1) {
                    const removed = lck.lockholders.delete(_uuid);
                    if (removed) {
                        lck.lockholdersAllReleased[_uuid] = true;
                    }
                }
                else {
                    for (const k of lck.lockholders.keys()) {
                        lck.lockholdersAllReleased[k] = true;
                    }
                    lck.lockholders = new Map();
                }
            }
            if (uuid && ws) {
                exports.log.debug('unlock: sending unlock success response for key:', key, 'uuid:', uuid, '_uuid:', _uuid);
                this.send(ws, {
                    uuid: uuid,
                    key: key,
                    lockRequestCount: ln,
                    type: 'unlock',
                    unlocked: true
                });
                exports.log.debug('unlock: unlock success response sent for key:', key, 'uuid:', uuid);
            }
            this.ensureNewLockHolder(lck, data);
            return;
        }
        if (lck) {
            const ln = lck.notify.length;
            if (lck.lockholderTimeouts[_uuid] || lck.lockholdersAllReleased[_uuid]) {
                delete lck.lockholderTimeouts[_uuid];
                delete lck.lockholdersAllReleased[_uuid];
                if (uuid && ws) {
                    this.send(ws, {
                        uuid: uuid,
                        key: key,
                        lockRequestCount: ln,
                        type: 'unlock',
                        unlocked: true
                    });
                }
                this.ensureNewLockHolder(lck, data);
                return;
            }
            if (uuid && ws) {
                this.send(ws, {
                    uuid: uuid,
                    key: key,
                    lockRequestCount: ln,
                    type: 'unlock',
                    error: 'You need to pass the correct uuid, or use force.',
                    unlocked: false
                });
            }
            else if (uuid) {
                this.emitter.emit('warning', 'lmx implementation warning - Missing ws (we have a uuid but no ws connection).');
            }
            else if (ws) {
                this.emitter.emit('warning', 'lmx implementation warning - Missing uuid (we have socket connection but no uuid).');
            }
            else {
                this.emitter.emit('warning', 'lmx implementation warning: missing uuid and socket connection.');
            }
            return;
        }
        exports.log.debug('lock was not defined / no longer existed.');
        exports.log.debug(data.rwStatus, 'has released lock on key:', key);
        this.emitter.emit('warning', 'lmx broker implementation warning: no lock with key => "' + key + '"');
        if (ws && uuid) {
            this.emitter.emit('warning', `lmx broker warning: no lock with key => '${key}'.`);
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
            this.emitter.emit('warning', 'lmx implementation warning: missing uuid (we have a socket connection but no uuid).');
        }
        else {
            this.emitter.emit('warning', 'lmx implementation warning: missing uuid and socket connection.');
        }
    }
}
exports.Broker1 = Broker1;
exports.LvMtxBroker = Broker1;
exports.LMXBroker = Broker1;
exports.default = Broker1;
