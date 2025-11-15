'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LMXBroker = exports.LvMtxBroker = exports.Broker = exports.validConstructorOptions = exports.log = void 0;
//core
const assert = __importStar(require("assert"));
const net = __importStar(require("net"));
const util = __importStar(require("util"));
const fs = __importStar(require("fs"));
//npm
const chalk_1 = __importDefault(require("chalk"));
const json_parser_1 = require("./json-parser");
const linked_queue_1 = require("@oresoftware/linked-queue");
//project
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
const path = __importStar(require("path"));
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
class Broker {
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
                // cleanUp();
                return cb && process.nextTick(cb);
            }
            ws.write(JSON.stringify(data) + '\n', 'utf8', (err) => {
                if (err) {
                    this.emitter.emit('warning', 'socket is not writable [2].');
                    this.emitter.emit('warning', err);
                    // cleanUp();
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
            if (data.type === 'register-write-flag-check-queued') {
                // This is a response type, not a request type - should not happen
                return;
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
            // if (data.type === 'unlock-received') {
            //   const key = data.key;
            //   clearTimeout(self.timeouts[key]);
            //   delete self.timeouts[key];
            //   return self.bookkeeping[key].unlockCount++;
            // }
            if (data.type === 'lock-client-timeout' || data.type === 'lock-client-error') {
                // if the client times out, we don't want to send them any more messages
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
                    // noop
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
                //ignore
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
        this.wsToUUIDs = new Map(); // keys are ws objects, values are lock key maps {uuid: true}
        this.wsToKeys = new Map(); // keys are ws objects, values are key maps {key: true}
        // if the user passes a callback then we call
        // ensure() on behalf of the user
        cb && this.ensure(cb);
    }
    static create(opts) {
        return new Broker(opts);
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
    /**
     * Attach a callback to listen for warning events and output them
     * @param callback Function that receives warning messages/errors
     */
    onWarning(callback) {
        this.emitter.on('warning', callback);
    }
    /**
     * Attach a callback to listen for error events and output them
     * @param callback Function that receives error messages
     */
    onError(callback) {
        this.emitter.on('error', callback);
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
        // Count all pending lock requests across all locks
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
        // Clean up Unix domain socket file if it exists
        if (this.socketFile) {
            try {
                if (fs.existsSync(this.socketFile)) {
                    fs.unlinkSync(this.socketFile);
                    exports.log.info('socket file unlinked:', this.socketFile);
                }
            }
            catch (err) {
                // ignore errors during cleanup
            }
        }
        // Close the server (works for both TCP and Unix domain sockets)
        if (this.wss) {
            this.wss.close((err) => {
                if (cb)
                    cb(err);
            });
        }
        else {
            if (cb)
                cb(null);
        }
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
                // we delay destroy the connection, so that we can tell the client about a version mismatch
                try {
                    ws.destroy();
                }
                finally {
                    ws.removeAllListeners();
                }
            }, 2000);
        }
        // return this.send(ws, {type:'broker-version', brokerVersion: brokerPackage.version});
    }
    cleanupConnection(ws) {
        if (ws.lmxClosed === true) {
            return;
        }
        ws.lmxClosed = true;
        this.connectedClients.delete(ws);
        const v = this.wsToKeys.get(ws);
        this.wsToKeys.delete(ws);
        const uuids = Object.keys(this.wsToUUIDs.get(ws) || {});
        this.wsToUUIDs.delete(ws);
        // Clean up registered listeners for this connection
        for (const key in this.registeredListeners) {
            const listeners = this.registeredListeners[key];
            if (listeners) {
                // Remove listeners associated with this websocket
                for (let i = listeners.length - 1; i >= 0; i--) {
                    if (listeners[i].ws === ws) {
                        listeners.splice(i, 1);
                    }
                }
                // Remove empty arrays
                if (listeners.length === 0) {
                    delete this.registeredListeners[key];
                }
            }
        }
        for (let [k, v] of this.locks) {
            const notify = v.notify;
            for (const uuid of Object.keys(uuids)) {
                notify.remove(uuid);
            }
            // Clear any timers associated with this websocket, before unlocking
            const uuidsToRemove = [];
            for (const [uuid, lockholder] of v.lockholders.entries()) {
                if (lockholder.ws === ws) {
                    if (lockholder.timer) {
                        clearTimeout(lockholder.timer);
                    }
                    uuidsToRemove.push(uuid);
                }
            }
            // Remove lockholders for this websocket
            for (const uuid of uuidsToRemove) {
                v.lockholders.delete(uuid);
            }
            if (v.isViaShell !== true) {
                // delete v[k];
                this.unlock({ force: true, key: k, from: 'client socket closed/ended/errored' }, ws);
            }
            else if (!v.keepLocksAfterDeath) {
                this.unlock({ force: true, key: k, from: 'client socket closed/ended/errored' }, ws);
            }
        }
        // Clear destroyTimeout if it exists
        if (ws.destroyTimeout) {
            clearTimeout(ws.destroyTimeout);
            ws.destroyTimeout = null;
        }
    }
    ls(data, ws) {
        return this.send(ws, { ls_result: Object.keys(this.locks), uuid: data.uuid });
    }
    broadcast(data, ws) {
        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];
        exports.log.debug(chalk_1.default.yellow('[BROKER-BROADCAST] broadcasting for key:'), key, 'listeners:', v.length);
        // Process all listeners and clear the array to prevent infinite loops
        const listenersToProcess = v.splice(0); // Remove all listeners at once
        exports.log.debug(chalk_1.default.yellow('[BROKER-BROADCAST] processing'), listenersToProcess.length, 'listeners for key:', key);
        for (const p of listenersToProcess) {
            if (p && p.fn) {
                try {
                    exports.log.debug(chalk_1.default.yellow('[BROKER-BROADCAST] calling listener fn for uuid:'), p.uuid);
                    p.fn();
                    exports.log.debug(chalk_1.default.yellow('[BROKER-BROADCAST] listener fn completed for uuid:'), p.uuid);
                }
                catch (err) {
                    exports.log.error('Error in broadcast listener:', err);
                }
            }
            if (p && p.ws) {
                exports.log.debug(chalk_1.default.yellow('[BROKER-BROADCAST] sending broadcast-result to uuid:'), p.uuid);
                this.send(p.ws, {
                    key: data.key,
                    uuid: p.uuid,
                    type: 'broadcast-result'
                });
            }
        }
        if (ws) {
            // if we call broadcast via broker, ws is null, so check if it exists
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
        lck.readers++;
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
        const listenersCount = this.registeredListeners[key]?.length || 0;
        exports.log.debug(chalk_1.default.yellow('[BROKER-BROADCAST] setWriteFlagToFalseAndBroadcast'), { key, uuid, listenersCount, notifyQueue: lck.notify.length });
        exports.log.debug('setting writer flag to false.');
        lck.writerFlag = false;
        exports.log.debug('broadcasting after setting writer flag to false.');
        this.broadcast({ key }, null);
        this.send(ws, { uuid, key, type: 'write-flag-false-and-broadcast-success' });
    }
    decrementReaders(data, ws) {
        const key = data.key;
        const uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        let lck = this.locks.get(key);
        exports.log.debug('decrementing readers. Current:', lck.readers);
        const r = lck.readers = Math.max(0, --lck.readers);
        exports.log.debug('decremented readers. New count:', r);
        // Only broadcast if readers reached zero AND there are registered listeners waiting
        if (r < 1) {
            const listeners = this.registeredListeners[key];
            if (listeners && listeners.length > 0) {
                exports.log.debug('broadcasting because readers are zero and there are', listeners.length, 'listeners waiting.');
                this.broadcast({ key }, null);
            }
            else {
                exports.log.debug('readers are zero but no listeners waiting, skipping broadcast.');
            }
        }
        this.send(ws, {
            key,
            uuid,
            type: 'decrement-readers-success'
        });
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
        if (writerFlag || readersCount > 1) {
            return v.push({
                ws, key, uuid, fn: () => {
                    exports.log.debug('delayed setting writer flag to true.');
                    lck.writerFlag = true;
                }
            });
        }
        exports.log.debug('setting writer flag to true.');
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
        if (writerFlag) {
            // Writer flag is set, queue this read request to wait for writer to finish
            v.push({
                ws, key, uuid, fn: () => {
                    exports.log.debug('incrementing readers in delayed fashion.');
                    lck.readers++;
                    // Send response after incrementing
                    this.send(ws, {
                        writerFlag: false,
                        readersCount: lck.readers,
                        key,
                        uuid,
                        type: 'register-write-flag-success'
                    });
                }
            });
            // Send initial response indicating we're queued
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
        // NOTE: Do NOT increment readers here - incrementReaders will be called separately after lock acquisition
        // This prevents double-counting readers
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
    ensureNewLockHolder(lck, data) {
        const locks = this.locks;
        const notifyList = lck.notify;
        // Remove previous lock holder if _uuid is provided and clear its timer
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
        // Get the current number of lock holders
        const count = lck.lockholders.size;
        // If no lock holders and no clients are waiting, mark the lock as emptied
        if (count < 1 && notifyList.length < 1) {
            lck.timestampEmptied = Date.now();
            return;
        }
        // While there are available slots in the semaphore and clients waiting,
        // continue granting locks
        while (notifyList.length > 0) { // Modified Condition
            // Check capacity BEFORE dequeuing to avoid unnecessary work
            if (lck.lockholders.size >= lck.max) {
                // Semaphore is at capacity, can't grant more locks
                break;
            }
            let lqValue;
            let n = null;
            // Find the next valid waiter
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
                // No more valid waiters in the queue
                break;
            }
            // Double check capacity immediately before granting (race condition protection)
            if (lck.lockholders.size >= lck.max) {
                exports.log.warn(`Semaphore reached max capacity of ${lck.max} for key "${key}" - can't grant more locks`);
                // Put this client back in the notify queue
                notifyList.enqueue(n.uuid, n);
                break;
            }
            // Found a valid client - grant them the lock
            const ws = n.ws;
            let ttl = n.ttl;
            const uuid = n.uuid;
            if (ttl !== Infinity) {
                ttl = we_are_debugging_1.weAreDebugging ? 50000000 : (n.ttl || this.lockExpiresAfter);
            }
            if (!this.wsToKeys.get(ws)) {
                this.wsToKeys.set(ws, {});
            }
            this.wsToKeys.get(ws)[key] = true;
            let timer = null;
            if (ttl !== Infinity) {
                // Set TTL for this specific lock holder
                timer = setTimeout(() => {
                    this.emitter.emit('warning', `lmx broker warning, lock holder timed out after ${ttl}ms for key => "${key}", uuid => "${uuid}"`);
                    if (this.locks.has(key)) {
                        const lock = this.locks.get(key);
                        // Mark that this specific holder timed out (for potential unlock requests)
                        lock.lockholderTimeouts[uuid] = true;
                        // Remove only this specific lock holder
                        const hadHolder = lock.lockholders.delete(uuid);
                        if (hadHolder) {
                            // If this is a semaphore (max > 1), only handle this specific holder
                            if (lock.max > 1) {
                                // Try to grant the lock to the next waiting client
                                this.ensureNewLockHolder(lock, { key, _uuid: uuid });
                            }
                            else {
                                // For exclusive locks, we can still use the force unlock
                                // as there's only one holder anyway
                                this.unlock({ key, force: true, from: 'ttl expired for exclusive lock' });
                            }
                        }
                    }
                }, ttl);
            }
            lck.lockholders.set(uuid, { pid: n.pid, uuid, ws, timer });
            lck.keepLocksAfterDeath = n.keepLocksAfterDeath || false;
            let ln = lck.notify.length;
            this.send(n.ws, {
                readersCount: lck.readers,
                key: data.key,
                uuid: n.uuid,
                type: 'lock',
                lockRequestCount: ln,
                acquired: true
            });
            // Clear existing timeout for this key if it exists
            if (this.timeouts[key]) {
                clearTimeout(this.timeouts[key]);
            }
            this.timeouts[key] = setTimeout(() => {
                try {
                    // @ts-ignore
                    delete this.wsToKeys.get(ws)[key];
                }
                catch (err) {
                    // ignore
                }
                delete self.timeouts[key];
                this.emitter.emit('warning', `Re-election occurring for key: "${key}"`);
                if (locks.has(key)) {
                    const lckTemp = locks.get(key);
                    // Clear timer if lockholder still exists
                    const lockholder = lckTemp.lockholders.get(uuid);
                    if (lockholder && lockholder.timer) {
                        clearTimeout(lockholder.timer);
                    }
                    lckTemp.lockholders.delete(uuid);
                    const ln = lckTemp.notify.length;
                    const notifyList = lckTemp.notify;
                    if (!self.rejected[n.uuid]) {
                        if (!notifyList.contains(n.uuid)) {
                            notifyList.enqueue(n.uuid, n);
                        }
                    }
                    // get the first 5, ideally we'd mix requests from different clients/ws
                    notifyList.deq(5).forEach((lqv) => {
                        // deq returns [K, V] tuples from dequeue() (despite type definition saying LinkedQueueValue)
                        let obj;
                        if (Array.isArray(lqv) && !linked_queue_1.IsVoid.check(lqv[0])) {
                            // It's a [K, V] tuple
                            obj = lqv[1];
                        }
                        else if (lqv && typeof lqv === 'object' && 'value' in lqv) {
                            // Fallback: might be LinkedQueueValue (though unlikely)
                            obj = lqv.value;
                        }
                        else {
                            return; // Skip invalid entries
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
                // timestampEmptied is probably null
                return;
            }
            if (now - v.timestampEmptied < 2000) { // 21600000
                // 6 hours has not transpired since last emptied
                return;
            }
            const notify = v.notify.getLength();
            const count = v.lockholders.size;
            if (count < 1 && notify < 1) {
                // we delete the lock object because it hasn't been used in a while
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
            // we look into cleaning up old locks every 30,000 lock requests
            this.cleanUpLocks();
        }
        const uuid = data.uuid;
        const pid = data.pid;
        const max = data.max; // max lockholders
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
            // lock object with given key exists
            // Update max BEFORE checking count to handle cases where max is increased
            // Always update if a valid max is provided (allows increasing max for RW locks)
            const oldMax = lck.max;
            if (Number.isInteger(max)) {
                lck.max = max;
            }
            const ln = lck.notify.length;
            const count = lck.lockholders.size;
            const beginRead = data.rwStatus === shared_internal_2.RWStatus.BeginRead;
            // For RW read locks, check readers count (accounting for the increment that will happen)
            // because readers are tracked separately and we need to check before incrementing
            // For non-read operations, use lockholders.size
            const effectiveCount = beginRead ? (lck.readers + 1) : count;
            // Use the new max if we increased it, otherwise use current max
            const effectiveMax = Number.isInteger(max) ? max : lck.max;
            // Strictly enforce max lock holders - prevent race conditions
            // For read operations, check if adding this reader would exceed max
            // For non-read operations, check current lockholders count
            if (effectiveCount >= effectiveMax) {
                // Only warn if we actually exceed the limit due to a race condition
                // Don't warn for write locks queuing behind readers (expected behavior)
                // Don't warn for read locks at the limit (expected when max is reached)
                // Don't warn if we just increased max to accommodate the current count
                // Only warn if there's a real race condition causing us to exceed the limit
                const maxWasIncreased = Number.isInteger(max) && max > oldMax;
                // If max was increased, check if effectiveCount is within the NEW max value
                // Otherwise, check against the current max
                const countWithinNewMax = maxWasIncreased && effectiveCount <= max;
                const isWriteLockQueuing = !beginRead && lck.readers > 0 && effectiveMax === 1;
                // Only warn if:
                // 1. Count exceeds effectiveMax, AND
                // 2. Not a write lock queuing behind readers, AND
                // 3. We didn't just increase max to accommodate this count
                if (effectiveCount > effectiveMax && !isWriteLockQueuing && !countWithinNewMax) {
                    exports.log.warn(`Semaphore limit exceeded: ${effectiveCount} ${beginRead ? 'readers (after increment)' : 'lock holders'} exceeds max of ${effectiveMax} for key "${key}"`);
                }
                // Lock exists *and* already has a lockholder; adding ws to list of to be notified
                // if we are retrying, we may attempt to call lock() more than once
                // we don't want to push the same ws object / same uuid combo to array
                if (force) {
                    // because of the force option, we put it to the front of the line
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
            // lck exists and we are below the max amount of lockholders
            // so we can acquire the lock
            exports.log.debug(data.rwStatus, 'has acquired lock on key:', key);
            if (beginRead) {
                // lck.readers = Math.max(20, lck.readers++);
                lck.readers++;
            }
            if (endRead) {
                // in case something weird happens, never let it go below 0.
                lck.readers = Math.max(0, --lck.readers);
            }
            if (!this.wsToKeys.has(ws)) {
                this.wsToKeys.set(ws, {});
            }
            this.wsToKeys.get(ws)[key] = true;
            const holderUuid = uuid;
            let timer = null;
            if (ttl !== Infinity) {
                timer = setTimeout(() => {
                    this.emitter.emit('warning', `lmx broker warning, lock holder timed out after ${ttl}ms for key => "${key}", uuid => "${holderUuid}"`);
                    if (this.locks.has(key)) {
                        const lock = this.locks.get(key);
                        // Mark that this specific holder timed out (for potential unlock requests)
                        lock.lockholderTimeouts[holderUuid] = true;
                        // Remove only this specific lock holder
                        const hadHolder = lock.lockholders.delete(holderUuid);
                        if (hadHolder) {
                            // If this is a semaphore (max > 1), only handle this specific holder
                            if (lock.max > 1) {
                                // Try to grant the lock to the next waiting client
                                this.ensureNewLockHolder(lock, { key, _uuid: holderUuid });
                            }
                            else {
                                // For exclusive locks, we can still use the force unlock
                                // as there's only one holder anyway
                                this.unlock({ key, force: true, from: 'ttl expired for exclusive lock' });
                            }
                        }
                    }
                }, ttl);
            }
            lck.lockholders.set(uuid, { ws, uuid, pid, timer });
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
        // this path: there is no existing lck, so we create a new lck object
        exports.log.debug(data.rwStatus, 'has acquired lock on key:', key);
        if (!this.wsToKeys.has(ws)) {
            this.wsToKeys.set(ws, {});
        }
        this.wsToKeys.get(ws)[key] = true;
        const lckTemp = this.getDefaultLockObject(key, keepLocksAfterDeath, max);
        this.locks.set(key, lckTemp);
        if (beginRead) {
            // lck.readers = Math.max(20, lck.readers++);
            lckTemp.readers++;
        }
        if (endRead) {
            // in case something weird happens, never let it go below 0.
            lckTemp.readers = Math.max(0, --lckTemp.readers);
        }
        const holderUuid = uuid;
        let timer = null;
        if (ttl !== Infinity) {
            // Set TTL for this specific lock holder
            timer = setTimeout(() => {
                this.emitter.emit('warning', `lmx broker warning, lock holder timed out after ${ttl}ms for key => "${key}", uuid => "${holderUuid}"`);
                if (this.locks.has(key)) {
                    const lock = this.locks.get(key);
                    // Mark that this specific holder timed out (for potential unlock requests)
                    lock.lockholderTimeouts[holderUuid] = true;
                    // Remove only this specific lock holder
                    const hadHolder = lock.lockholders.delete(holderUuid);
                    if (hadHolder) {
                        // If this is a semaphore (max > 1), only handle this specific holder
                        if (lock.max > 1) {
                            // Try to grant the lock to the next waiting client
                            this.ensureNewLockHolder(lock, { key, _uuid: holderUuid });
                        }
                        else {
                            // For exclusive locks, we can still use the force unlock
                            // as there's only one holder anyway
                            this.unlock({ key, force: true, from: 'ttl expired for exclusive lock' });
                        }
                    }
                }
            }, ttl);
        }
        lckTemp.lockholders.set(uuid, { ws, uuid, pid, timer });
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
        const rwStatus = data.rwStatus;
        const lck = this.locks.get(key);
        const keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
        exports.log.debug(chalk_1.default.yellow('[BROKER-UNLOCK] unlock called'), { key, uuid, _uuid, force, hasLock: !!lck, lockholders: lck?.lockholders.size, notifyQueue: lck?.notify.length });
        if (ws && keepLocksAfterDeath !== true) {
            // we know for a fact that
            // this websocket connection no longer owns this key
            try {
                // @ts-ignore
                delete this.wsToKeys.get(ws)[key];
            }
            catch (err) {
                // ignore err
            }
        }
        try {
            // @ts-ignore
            delete this.wsToUUIDs.get(ws)[_uuid];
        }
        catch (err) {
            // ignore err
        }
        // if the user passed _uuid, then we check it, other true
        // _uuid is the uuid of the original lockholder call
        // the unlock caller can be given right to unlock only if it holds
        // the uuid from the original lock call, as a safeguard
        // this prevents a function from being called at the wrong time, or more than once, etc.
        let same = null;
        if (_uuid && lck) {
            same = lck.lockholders.has(_uuid);
            exports.log.debug('same is:', same);
        }
        else if (lck) {
            // Changed to debug to avoid excessive error logs on force unlocks
            exports.log.debug('no _uuid was passed to unlock');
        }
        if (lck && (same || force)) {
            const ln = lck.notify.length;
            if (force) {
                // If this is a semaphore lock and we're just targeting one lock holder,
                // only remove that specific holder
                if (_uuid && lck.max > 1) {
                    // Get the lockholder's information before deleting
                    const lockholder = lck.lockholders.get(_uuid);
                    if (lockholder && lockholder.timer) {
                        clearTimeout(lockholder.timer);
                    }
                    // Just remove this specific lock holder
                    const removed = lck.lockholders.delete(_uuid);
                    if (removed) {
                        lck.lockholdersAllReleased[_uuid] = true;
                    }
                }
                else {
                    // Traditional force behavior - remove all lock holders
                    for (const k of lck.lockholders.keys()) {
                        const lockholder = lck.lockholders.get(k);
                        if (lockholder && lockholder.timer) {
                            clearTimeout(lockholder.timer);
                        }
                        lck.lockholdersAllReleased[k] = true;
                    }
                    lck.lockholders = new Map();
                }
            }
            else {
                // Normal unlock - remove the specific lockholder
                const lockholder = lck.lockholders.get(_uuid);
                if (lockholder && lockholder.timer) {
                    clearTimeout(lockholder.timer);
                }
                // remove the lockholder
                lck.lockholders.delete(_uuid);
            }
            // delete lck.lockholderTimeouts[_uuid];
            if (uuid && ws) {
                // if no uuid is defined, then unlock was called by something other than the client
                // aka this library called unlock when there was a timeout
                exports.log.debug(chalk_1.default.yellow('[BROKER-UNLOCK] sending unlock success'), { key, uuid, lockRequestCount: ln, remainingLockholders: lck.lockholders.size, notifyQueue: lck.notify.length });
                this.send(ws, {
                    uuid: uuid,
                    key: key,
                    lockRequestCount: ln,
                    type: 'unlock',
                    unlocked: true
                });
            }
            // Don't call ensureNewLockHolder if this is an RW unlock operation
            // that will be handled by setWriteFlagToFalse or decrementReaders
            if (rwStatus !== shared_internal_2.RWStatus.UnlockingWriteKey && rwStatus !== shared_internal_2.RWStatus.EndRead) {
                this.ensureNewLockHolder(lck, data);
            }
            return;
        }
        if (lck) {
            // we have a lock, but not the same key and force option was not used
            const ln = lck.notify.length;
            if (lck.lockholderTimeouts[_uuid] || lck.lockholdersAllReleased[_uuid]) {
                delete lck.lockholderTimeouts[_uuid];
                delete lck.lockholdersAllReleased[_uuid];
                if (uuid && ws) {
                    // if no uuid is defined, then unlock was called by something other than the client
                    // aka this library called unlock when there was a timeout
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
                // if no uuid is defined, then unlock was called by something other than the client
                // aka this library called unlock when there was a timeout
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
        // lck is not defined
        exports.log.debug('lock was not defined / no longer existed.');
        exports.log.debug(data.rwStatus, 'has released lock on key:', key);
        this.emitter.emit('warning', 'lmx broker implementation warning: no lock with key => "' + key + '"');
        // since the lock no longer exists for this key, remove ownership of this key
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
exports.Broker = Broker;
// aliases
exports.LvMtxBroker = Broker;
exports.LMXBroker = Broker;
exports.default = Broker;
