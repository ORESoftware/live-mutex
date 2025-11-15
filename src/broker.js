'use strict';
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LMXBroker = exports.LvMtxBroker = exports.Broker = exports.validConstructorOptions = exports.log = void 0;
//core
var assert = require("assert");
var net = require("net");
var util = require("util");
var fs = require("fs");
//npm
var chalk_1 = require("chalk");
var json_parser_1 = require("./json-parser");
var linked_queue_1 = require("@oresoftware/linked-queue");
//project
var isLocalDev = process.env.oresoftware_local_dev === 'yes';
var shared_internal_1 = require("./shared-internal");
var debugLog = process.argv.indexOf('--lmx-debug') > 0 || process.env.lmx_debug === 'yes';
exports.log = {
    info: console.log.bind(console, chalk_1.default.gray.bold('lmx broker info:')),
    error: console.error.bind(console, chalk_1.default.red.bold('lmx broker error:')),
    warn: console.error.bind(console, chalk_1.default.yellow.bold('lmx broker warning:')),
    debug: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (debugLog) {
            var newTime = Date.now();
            var elapsed = newTime - shared_internal_1.forDebugging.previousTime;
            shared_internal_1.forDebugging.previousTime = newTime;
            console.log.apply(console, __spreadArray([chalk_1.default.yellow.bold('lmx broker debugging:'), 'elapsed millis:', "(".concat(elapsed, ")")], args, false));
        }
    }
};
var we_are_debugging_1 = require("./we-are-debugging");
var events_1 = require("events");
var path = require("path");
var shared_internal_2 = require("./shared-internal");
var compare_versions_1 = require("./compare-versions");
var shared_internal_3 = require("./shared-internal");
if (we_are_debugging_1.weAreDebugging) {
    exports.log.error('Broker is in debug mode. Timeouts are turned off.');
}
var brokerPackage = require('../package.json');
if (!(brokerPackage.version && typeof brokerPackage.version === 'string')) {
    throw new Error('Broker NPM package did not have a top-level field that is a string.');
}
process.on('uncaughtException', function (e) {
    if (process.env.lmx_log_errors !== 'nope') {
        exports.log.error('Uncaught Exception event occurred in Broker process:', (0, shared_internal_2.inspectError)(e));
    }
});
process.on('warning', function (e) {
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
var Broker = /** @class */ (function () {
    function Broker(o, cb) {
        var _this = this;
        this.locks = new Map();
        this.emitter = new events_1.EventEmitter();
        this.noDelay = true;
        this.socketFile = '';
        this.lockCounts = 0;
        this.connectedClients = new Set();
        this.registeredListeners = {};
        this.isOpen = false;
        var opts = this.opts = o || {};
        assert.strict(typeof opts === 'object', 'Options argument must be an object.');
        for (var _i = 0, _a = Object.keys(opts); _i < _a.length; _i++) {
            var k = _a[_i];
            if (!exports.validConstructorOptions[k]) {
                throw new Error((0, shared_internal_3.joinToStr)('An option passed to lmx broker constructor', "is not a recognized option => \"".concat(k, "\", valid options are: ").concat(util.inspect(exports.validConstructorOptions), ".")));
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
        var self = this;
        this.emitter.on('warning', function () {
            if (self.emitter.listenerCount('warning') < 2) {
                exports.log.warn('No "warning" event handlers attached by end-user to the broker emitter, therefore logging these errors from library:');
                exports.log.warn.apply(exports.log, arguments);
                exports.log.warn('Add a "warning" event listener to the lmx broker emitter to get rid of this message.');
            }
        });
        this.send = function (ws, data, cb) {
            if (!ws.writable) {
                _this.emitter.emit('warning', 'socket is not writable [1].');
                // cleanUp();
                return cb && process.nextTick(cb);
            }
            ws.write(JSON.stringify(data) + '\n', 'utf8', function (err) {
                if (err) {
                    _this.emitter.emit('warning', 'socket is not writable [2].');
                    _this.emitter.emit('warning', err);
                    // cleanUp();
                }
                cb && process.nextTick(cb);
            });
        };
        var onData = function (ws, data) {
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
            var key = data.key;
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
                var lck = self.locks.get(key);
                var uuid = data.uuid;
                if (!lck) {
                    _this.emitter.emit('warning', "Lock for key \"".concat(key, "\" has probably expired."));
                    return;
                }
                return lck.notify.remove(uuid);
            }
            if (data.type === 'lock-received-rejected') {
                var lck = self.locks.get(key);
                if (!lck) {
                    _this.emitter.emit('warning', "Lock for key \"".concat(key, "\" has probably expired."));
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
            _this.emitter.emit('warning', "implementation error, bad data sent to broker => ".concat(util.inspect(data)));
            self.send(ws, {
                key: data.key,
                uuid: data.uuid,
                error: 'Malformed data sent to Live-Mutex broker.'
            });
        };
        var wss = this.wss = net.createServer({}, function (ws) {
            _this.connectedClients.add(ws);
            if (self.noDelay) {
                ws.setNoDelay(true);
            }
            if (!self.wsToKeys.get(ws)) {
                self.wsToKeys.set(ws, {});
            }
            var endWS = function () {
                try {
                    ws.destroy();
                }
                finally {
                    // noop
                }
            };
            ws.once('disconnect', function () {
                _this.cleanupConnection(ws);
                ws.destroy();
                ws.removeAllListeners();
            });
            ws.once('end', function () {
                _this.cleanupConnection(ws);
                ws.destroy();
                ws.removeAllListeners();
            });
            ws.once('error', function (err) {
                _this.emitter.emit('warning', 'lmx client error: ' + (0, shared_internal_2.inspectError)(err));
                _this.cleanupConnection(ws);
                ws.destroy();
                ws.removeAllListeners();
            });
            ws.pipe((0, json_parser_1.createParser)())
                .on('data', function (v) {
                onData(ws, v);
            })
                .once('error', function (e) {
                self.send(ws, {
                    error: (0, shared_internal_2.inspectError)(e)
                }, function () {
                    ws.end();
                });
            });
        });
        var sigEventCallable = true;
        var handleShutdown = function (event) {
            if (!sigEventCallable) {
                return;
            }
            sigEventCallable = false;
            _this.emitter.emit('warning', "\"".concat(event, "\" event has occurred."));
            try {
                if (_this.socketFile) {
                    fs.unlinkSync(_this.socketFile);
                    exports.log.info('socket file unlinked:', _this.socketFile);
                }
            }
            catch (err) {
                //ignore
            }
            for (var _i = 0, _a = _this.connectedClients; _i < _a.length; _i++) {
                var c = _a[_i];
                c.destroy();
            }
            wss.close(function () {
                process.exit(1);
            });
        };
        process.once('exit', function () { return handleShutdown('exit'); });
        process.once('SIGINT', function () { return handleShutdown('SIGINT'); });
        process.once('SIGTERM', function () { return handleShutdown('SIGTERM'); });
        wss.on('error', function (err) {
            _this.emitter.emit('warning', 'lmx broker error' + (0, shared_internal_2.inspectError)(err));
        });
        var brokerPromise;
        this.ensure = this.start = function (cb) {
            if (cb && typeof cb !== 'function') {
                throw new Error('optional argument to ensure/connect must be a function.');
            }
            if (cb && process.domain) {
                cb = process.domain.bind(cb);
            }
            if (brokerPromise) {
                return brokerPromise.then(function (val) {
                    cb && cb.call(self, null, val);
                    return val;
                }, function (err) {
                    cb && cb.call(self, err, {});
                    return Promise.reject(err);
                });
            }
            var onResolve = function (val) {
                cb && cb.call(self, null, val);
                return val;
            };
            var onRejected = function (err) {
                cb && cb.call(self, err, {});
                return Promise.reject(err);
            };
            if (_this.noListen) {
                return brokerPromise =
                    Promise.resolve(_this)
                        .then(onResolve)
                        .catch(onRejected);
            }
            return brokerPromise = new Promise(function (resolve, reject) {
                var to = setTimeout(function () {
                    reject('lmx broker error: listening action timed out.');
                }, 3000);
                wss.once('error', reject);
                var listenCallback = function () {
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
    Broker.create = function (opts) {
        return new Broker(opts);
    };
    Broker.prototype.emit = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        exports.log.warn('warning:', 'use b.emitter.emit() instead of b.emit()');
        return this.emitter.emit.apply(this.emitter, args);
    };
    Broker.prototype.on = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        exports.log.warn('warning:', 'use c.emitter.on() instead of c.on()');
        return this.emitter.on.apply(this.emitter, args);
    };
    Broker.prototype.once = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        exports.log.warn('warning:', 'use c.emitter.once() instead of c.once()');
        return this.emitter.once.apply(this.emitter, args);
    };
    /**
     * Attach a callback to listen for warning events and output them
     * @param callback Function that receives warning messages/errors
     */
    Broker.prototype.onWarning = function (callback) {
        this.emitter.on('warning', callback);
    };
    Broker.prototype.ping = function (data, ws) {
        var uuid = data.uuid;
        var timestamp = data.timestamp || Date.now();
        this.send(ws, {
            uuid: uuid,
            type: 'pong',
            timestamp: timestamp,
            serverTimestamp: Date.now(),
            ping: true
        });
    };
    Broker.prototype.getSystemStats = function (data, ws) {
        var uuid = data.uuid;
        // Count all pending lock requests across all locks
        var pendingRequests = 0;
        this.locks.forEach(function (lock) {
            pendingRequests += lock.notify.length || 0;
        });
        var stats = {
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
    };
    Broker.prototype.close = function (cb) {
        this.wss.close(cb);
    };
    Broker.prototype.getListeningInterface = function () {
        return this.socketFile || this.port;
    };
    Broker.prototype.getVersion = function () {
        return brokerPackage.version;
    };
    Broker.prototype.getPort = function () {
        return this.port;
    };
    Broker.prototype.getHost = function () {
        return this.host;
    };
    Broker.prototype.abruptlyDestroyConnection = function (ws) {
        exports.log.error('Connection will be destroyed.');
        ws.destroy();
        ws.removeAllListeners();
    };
    Broker.prototype.abruptlyEndConnection = function (ws) {
        exports.log.error('Connection will be ended.');
        ws.end();
        ws.removeAllListeners();
    };
    Broker.prototype.onVersion = function (data, ws) {
        var clientVersion = data.value;
        var brokerVersion = brokerPackage.version;
        try {
            (0, compare_versions_1.compareVersions)(clientVersion, brokerVersion);
        }
        catch (err) {
            this.cleanupConnection(ws);
            var errMessage = "Client version is not compatable with broker," +
                " client version: '".concat(clientVersion, "', broker version: '").concat(brokerVersion, "'.");
            exports.log.error(err);
            exports.log.error(errMessage);
            this.emitter.emit('error', errMessage);
            this.send(ws, { type: 'version-mismatch', versions: { clientVersion: clientVersion, brokerVersion: brokerVersion } });
            ws.destroyTimeout = setTimeout(function () {
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
    };
    Broker.prototype.cleanupConnection = function (ws) {
        if (ws.lmxClosed === true) {
            return;
        }
        ws.lmxClosed = true;
        this.connectedClients.delete(ws);
        var v = this.wsToKeys.get(ws);
        this.wsToKeys.delete(ws);
        var uuids = Object.keys(this.wsToUUIDs.get(ws) || {});
        this.wsToUUIDs.delete(ws);
        // Clean up registered listeners for this connection
        for (var key in this.registeredListeners) {
            var listeners = this.registeredListeners[key];
            if (listeners) {
                // Remove listeners associated with this websocket
                for (var i = listeners.length - 1; i >= 0; i--) {
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
        for (var _i = 0, _a = this.locks; _i < _a.length; _i++) {
            var _b = _a[_i], k = _b[0], v_1 = _b[1];
            var notify = v_1.notify;
            for (var _c = 0, _d = Object.keys(uuids); _c < _d.length; _c++) {
                var uuid = _d[_c];
                notify.remove(uuid);
            }
            // Clear any timers associated with this websocket, before unlocking
            var uuidsToRemove = [];
            for (var _e = 0, _f = v_1.lockholders.entries(); _e < _f.length; _e++) {
                var _g = _f[_e], uuid = _g[0], lockholder = _g[1];
                if (lockholder.ws === ws) {
                    if (lockholder.timer) {
                        clearTimeout(lockholder.timer);
                    }
                    uuidsToRemove.push(uuid);
                }
            }
            // Remove lockholders for this websocket
            for (var _h = 0, uuidsToRemove_1 = uuidsToRemove; _h < uuidsToRemove_1.length; _h++) {
                var uuid = uuidsToRemove_1[_h];
                v_1.lockholders.delete(uuid);
            }
            if (v_1.isViaShell !== true) {
                // delete v[k];
                this.unlock({ force: true, key: k, from: 'client socket closed/ended/errored' }, ws);
            }
            else if (!v_1.keepLocksAfterDeath) {
                this.unlock({ force: true, key: k, from: 'client socket closed/ended/errored' }, ws);
            }
        }
        // Clear destroyTimeout if it exists
        if (ws.destroyTimeout) {
            clearTimeout(ws.destroyTimeout);
            ws.destroyTimeout = null;
        }
    };
    Broker.prototype.ls = function (data, ws) {
        return this.send(ws, { ls_result: Object.keys(this.locks), uuid: data.uuid });
    };
    Broker.prototype.broadcast = function (data, ws) {
        var key = data.key;
        var uuid = data.uuid;
        var v = this.registeredListeners[key] = this.registeredListeners[key] || [];
        exports.log.debug(chalk_1.default.yellow('[BROKER-BROADCAST] broadcasting for key:'), key, 'listeners:', v.length);
        // Process all listeners and clear the array to prevent infinite loops
        var listenersToProcess = v.splice(0); // Remove all listeners at once
        exports.log.debug(chalk_1.default.yellow('[BROKER-BROADCAST] processing'), listenersToProcess.length, 'listeners for key:', key);
        for (var _i = 0, listenersToProcess_1 = listenersToProcess; _i < listenersToProcess_1.length; _i++) {
            var p = listenersToProcess_1[_i];
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
    };
    Broker.prototype.incrementReaders = function (data, ws) {
        var key = data.key;
        var uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        var lck = this.locks.get(key);
        lck.readers++;
        this.send(ws, {
            key: key,
            uuid: uuid,
            type: 'increment-readers-success'
        });
    };
    Broker.prototype.setWriteFlagToFalseAndBroadcast = function (data, ws) {
        var _a;
        var key = data.key;
        var uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        var lck = this.locks.get(key);
        var listenersCount = ((_a = this.registeredListeners[key]) === null || _a === void 0 ? void 0 : _a.length) || 0;
        exports.log.debug(chalk_1.default.yellow('[BROKER-BROADCAST] setWriteFlagToFalseAndBroadcast'), { key: key, uuid: uuid, listenersCount: listenersCount, notifyQueue: lck.notify.length });
        exports.log.debug('setting writer flag to false.');
        lck.writerFlag = false;
        exports.log.debug('broadcasting after setting writer flag to false.');
        this.broadcast({ key: key }, null);
        this.send(ws, { uuid: uuid, key: key, type: 'write-flag-false-and-broadcast-success' });
    };
    Broker.prototype.decrementReaders = function (data, ws) {
        var key = data.key;
        var uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        var lck = this.locks.get(key);
        exports.log.debug('decrementing readers. Current:', lck.readers);
        var r = lck.readers = Math.max(0, --lck.readers);
        exports.log.debug('decremented readers. New count:', r);
        // Only broadcast if readers reached zero AND there are registered listeners waiting
        if (r < 1) {
            var listeners = this.registeredListeners[key];
            if (listeners && listeners.length > 0) {
                exports.log.debug('broadcasting because readers are zero and there are', listeners.length, 'listeners waiting.');
                this.broadcast({ key: key }, null);
            }
            else {
                exports.log.debug('readers are zero but no listeners waiting, skipping broadcast.');
            }
        }
        this.send(ws, {
            key: key,
            uuid: uuid,
            type: 'decrement-readers-success'
        });
    };
    Broker.prototype.registerWriteFlagAndReadersCheck = function (data, ws) {
        var key = data.key;
        var uuid = data.uuid;
        var v = this.registeredListeners[key] = this.registeredListeners[key] || [];
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        var lck = this.locks.get(key);
        var readersCount = lck && lck.readers || 0;
        var writerFlag = lck.writerFlag || false;
        if (writerFlag || readersCount > 1) {
            return v.push({
                ws: ws,
                key: key,
                uuid: uuid,
                fn: function () {
                    exports.log.debug('delayed setting writer flag to true.');
                    lck.writerFlag = true;
                }
            });
        }
        exports.log.debug('setting writer flag to true.');
        lck.writerFlag = true;
        this.send(ws, {
            readersCount: readersCount,
            writerFlag: writerFlag,
            key: key,
            uuid: uuid,
            type: 'register-write-flag-and-readers-check-success'
        });
    };
    Broker.prototype.getDefaultLockObject = function (key, keepLocksAfterDeath, max) {
        return {
            readers: 0,
            max: max || 1,
            lockholders: new Map(),
            lockholdersAllReleased: {},
            keepLocksAfterDeath: keepLocksAfterDeath,
            lockholderTimeouts: {},
            key: key,
            notify: new linked_queue_1.LinkedQueue(),
            writerFlag: false,
            timestampEmptied: null
        };
    };
    Broker.prototype.registerWriteFlagCheck = function (data, ws) {
        var _this = this;
        var key = data.key;
        var uuid = data.uuid;
        var v = this.registeredListeners[key] = this.registeredListeners[key] || [];
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        var lck = this.locks.get(key);
        var readersCount = lck.readers || 0;
        var writerFlag = lck.writerFlag || false;
        if (writerFlag) {
            // Writer flag is set, queue this read request to wait for writer to finish
            v.push({
                ws: ws,
                key: key,
                uuid: uuid,
                fn: function () {
                    exports.log.debug('incrementing readers in delayed fashion.');
                    lck.readers++;
                    // Send response after incrementing
                    _this.send(ws, {
                        writerFlag: false,
                        readersCount: lck.readers,
                        key: key,
                        uuid: uuid,
                        type: 'register-write-flag-success'
                    });
                }
            });
            // Send initial response indicating we're queued
            this.send(ws, {
                writerFlag: true,
                readersCount: readersCount,
                key: key,
                uuid: uuid,
                type: 'register-write-flag-check-queued'
            });
            return;
        }
        exports.log.debug('registerWriteFlagCheck: no writer flag, allowing read to proceed for key:', key, 'current readers:', lck.readers);
        // NOTE: Do NOT increment readers here - incrementReaders will be called separately after lock acquisition
        // This prevents double-counting readers
        this.send(ws, {
            writerFlag: writerFlag,
            readersCount: readersCount,
            key: key,
            uuid: uuid,
            type: 'register-write-flag-success'
        });
    };
    Broker.prototype.inspect = function (data, ws) {
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
    };
    Broker.prototype.ensureNewLockHolder = function (lck, data) {
        var _this = this;
        var locks = this.locks;
        var notifyList = lck.notify;
        // Remove previous lock holder if _uuid is provided and clear its timer
        if (data._uuid) {
            var lockholder = lck.lockholders.get(data._uuid);
            if (lockholder && lockholder.timer) {
                clearTimeout(lockholder.timer);
            }
            lck.lockholders.delete(data._uuid);
        }
        lck.keepLocksAfterDeath = null;
        var key = data.key;
        var self = this;
        // Get the current number of lock holders
        var count = lck.lockholders.size;
        // If no lock holders and no clients are waiting, mark the lock as emptied
        if (count < 1 && notifyList.length < 1) {
            lck.timestampEmptied = Date.now();
            return;
        }
        var _loop_1 = function () {
            // Check capacity BEFORE dequeuing to avoid unnecessary work
            if (lck.lockholders.size >= lck.max) {
                return "break";
            }
            var lqValue = void 0;
            var n = null;
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
                return "break";
            }
            // Double check capacity immediately before granting (race condition protection)
            if (lck.lockholders.size >= lck.max) {
                exports.log.warn("Semaphore reached max capacity of ".concat(lck.max, " for key \"").concat(key, "\" - can't grant more locks"));
                // Put this client back in the notify queue
                notifyList.enqueue(n.uuid, n);
                return "break";
            }
            // Found a valid client - grant them the lock
            var ws = n.ws;
            var ttl = n.ttl;
            var uuid = n.uuid;
            if (ttl !== Infinity) {
                ttl = we_are_debugging_1.weAreDebugging ? 50000000 : (n.ttl || this_1.lockExpiresAfter);
            }
            if (!this_1.wsToKeys.get(ws)) {
                this_1.wsToKeys.set(ws, {});
            }
            this_1.wsToKeys.get(ws)[key] = true;
            var timer = null;
            if (ttl !== Infinity) {
                // Set TTL for this specific lock holder
                timer = setTimeout(function () {
                    _this.emitter.emit('warning', "lmx broker warning, lock holder timed out after ".concat(ttl, "ms for key => \"").concat(key, "\", uuid => \"").concat(uuid, "\""));
                    if (_this.locks.has(key)) {
                        var lock = _this.locks.get(key);
                        // Mark that this specific holder timed out (for potential unlock requests)
                        lock.lockholderTimeouts[uuid] = true;
                        // Remove only this specific lock holder
                        var hadHolder = lock.lockholders.delete(uuid);
                        if (hadHolder) {
                            // If this is a semaphore (max > 1), only handle this specific holder
                            if (lock.max > 1) {
                                // Try to grant the lock to the next waiting client
                                _this.ensureNewLockHolder(lock, { key: key, _uuid: uuid });
                            }
                            else {
                                // For exclusive locks, we can still use the force unlock
                                // as there's only one holder anyway
                                _this.unlock({ key: key, force: true, from: 'ttl expired for exclusive lock' });
                            }
                        }
                    }
                }, ttl);
            }
            lck.lockholders.set(uuid, { pid: n.pid, uuid: uuid, ws: ws, timer: timer });
            lck.keepLocksAfterDeath = n.keepLocksAfterDeath || false;
            var ln = lck.notify.length;
            this_1.send(n.ws, {
                readersCount: lck.readers,
                key: data.key,
                uuid: n.uuid,
                type: 'lock',
                lockRequestCount: ln,
                acquired: true
            });
            // Clear existing timeout for this key if it exists
            if (this_1.timeouts[key]) {
                clearTimeout(this_1.timeouts[key]);
            }
            this_1.timeouts[key] = setTimeout(function () {
                try {
                    // @ts-ignore
                    delete _this.wsToKeys.get(ws)[key];
                }
                catch (err) {
                    // ignore
                }
                delete self.timeouts[key];
                _this.emitter.emit('warning', "Re-election occurring for key: \"".concat(key, "\""));
                if (locks.has(key)) {
                    var lckTemp = locks.get(key);
                    // Clear timer if lockholder still exists
                    var lockholder = lckTemp.lockholders.get(uuid);
                    if (lockholder && lockholder.timer) {
                        clearTimeout(lockholder.timer);
                    }
                    lckTemp.lockholders.delete(uuid);
                    var ln_1 = lckTemp.notify.length;
                    var notifyList_1 = lckTemp.notify;
                    if (!self.rejected[n.uuid]) {
                        if (!notifyList_1.contains(n.uuid)) {
                            notifyList_1.enqueue(n.uuid, n);
                        }
                    }
                    // get the first 5, ideally we'd mix requests from different clients/ws
                    notifyList_1.deq(5).forEach(function (lqv) {
                        // deq returns [K, V] tuples from dequeue() (despite type definition saying LinkedQueueValue)
                        var obj;
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
                            lockRequestCount: ln_1,
                            reelection: true
                        });
                    });
                }
            }, self.timeoutToFindNewLockholder);
        };
        var this_1 = this;
        // While there are available slots in the semaphore and clients waiting,
        // continue granting locks
        while (notifyList.length > 0) {
            var state_1 = _loop_1();
            if (state_1 === "break")
                break;
        }
    };
    Broker.prototype.retrieveLockInfo = function (data, ws) {
        var key = data.key;
        var lck = this.locks.get(key);
        var uuid = data.uuid;
        var lockholderUUIDs = Object.keys(lck || {});
        var isLocked = lockholderUUIDs.length > 0;
        var lockRequestCount = lck ? lck.notify.length : null;
        if (isLocked && lockRequestCount > 0) {
            this.emitter.emit('warning', 'lmx implementation warning, lock is unlocked but ' +
                'notify array has at least one item, for key => ' + key);
        }
        this.send(ws, {
            key: key,
            uuid: uuid,
            lockholderUUIDs: lockholderUUIDs,
            lockRequestCount: lockRequestCount,
            isLocked: Boolean(isLocked),
            lockInfo: true,
            type: 'lock-info-response'
        });
    };
    Broker.prototype.cleanUpLocks = function () {
        var _this = this;
        this.lockCounts = 0;
        var now = Date.now();
        this.locks.forEach(function (v, k) {
            if (!v.timestampEmptied) {
                // timestampEmptied is probably null
                return;
            }
            if (now - v.timestampEmptied < 2000) { // 21600000
                // 6 hours has not transpired since last emptied
                return;
            }
            var notify = v.notify.getLength();
            var count = v.lockholders.size;
            if (count < 1 && notify < 1) {
                // we delete the lock object because it hasn't been used in a while
                exports.log.info(chalk_1.default.yellow('deleted lock object with key:'), k);
                _this.locks.delete(k);
            }
        });
    };
    Broker.prototype.lock = function (data, ws) {
        var _this = this;
        var key = data.key;
        var keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
        var lck = this.locks.get(key);
        if (lck) {
            lck.timestampEmptied = null;
        }
        if (++this.lockCounts > 3) {
            // we look into cleaning up old locks every 30,000 lock requests
            this.cleanUpLocks();
        }
        var uuid = data.uuid;
        var pid = data.pid;
        var max = data.max; // max lockholders
        var beginRead = data.rwStatus === shared_internal_2.RWStatus.BeginRead;
        var endRead = data.rwStatus === shared_internal_2.RWStatus.EndRead;
        var force = data.force;
        var retryCount = data.retryCount;
        if (lck) {
            var count = lck.lockholders.size;
            exports.log.debug(data.rwStatus, 'is contending for lock on key:', key, 'there is/are', count, 'lockholders.');
        }
        var ttl = data.ttl;
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
            if (Number.isInteger(max)) {
                lck.max = max;
            }
            var ln = lck.notify.length;
            var count = lck.lockholders.size;
            // Strictly enforce max lock holders - prevent race conditions
            if (count >= lck.max) {
                if (count > lck.max) {
                    exports.log.warn("Semaphore limit exceeded: ".concat(count, " lock holders exceeds max of ").concat(lck.max, " for key \"").concat(key, "\""));
                }
                // Lock exists *and* already has a lockholder; adding ws to list of to be notified
                // if we are retrying, we may attempt to call lock() more than once
                // we don't want to push the same ws object / same uuid combo to array
                if (force) {
                    // because of the force option, we put it to the front of the line
                    lck.notify.remove(uuid);
                    lck.notify.addToFront(uuid, { ws: ws, uuid: uuid, pid: pid, ttl: ttl, keepLocksAfterDeath: keepLocksAfterDeath });
                }
                else {
                    var alreadyAddedResult = lck.notify.get(uuid);
                    var alreadyAdded = alreadyAddedResult && !linked_queue_1.IsVoid.check(alreadyAddedResult[0]);
                    if (!alreadyAdded) {
                        if (retryCount > 0) {
                            lck.notify.addToFront(uuid, { ws: ws, uuid: uuid, pid: pid, ttl: ttl, keepLocksAfterDeath: keepLocksAfterDeath });
                        }
                        else {
                            lck.notify.enqueue(uuid, { ws: ws, uuid: uuid, pid: pid, ttl: ttl, keepLocksAfterDeath: keepLocksAfterDeath });
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
            var holderUuid_1 = uuid;
            var timer_1 = null;
            if (ttl !== Infinity) {
                timer_1 = setTimeout(function () {
                    _this.emitter.emit('warning', "lmx broker warning, lock holder timed out after ".concat(ttl, "ms for key => \"").concat(key, "\", uuid => \"").concat(holderUuid_1, "\""));
                    if (_this.locks.has(key)) {
                        var lock = _this.locks.get(key);
                        // Mark that this specific holder timed out (for potential unlock requests)
                        lock.lockholderTimeouts[holderUuid_1] = true;
                        // Remove only this specific lock holder
                        var hadHolder = lock.lockholders.delete(holderUuid_1);
                        if (hadHolder) {
                            // If this is a semaphore (max > 1), only handle this specific holder
                            if (lock.max > 1) {
                                // Try to grant the lock to the next waiting client
                                _this.ensureNewLockHolder(lock, { key: key, _uuid: holderUuid_1 });
                            }
                            else {
                                // For exclusive locks, we can still use the force unlock
                                // as there's only one holder anyway
                                _this.unlock({ key: key, force: true, from: 'ttl expired for exclusive lock' });
                            }
                        }
                    }
                }, ttl);
            }
            lck.lockholders.set(uuid, { ws: ws, uuid: uuid, pid: pid, timer: timer_1 });
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
        var lckTemp = this.getDefaultLockObject(key, keepLocksAfterDeath, max);
        this.locks.set(key, lckTemp);
        if (beginRead) {
            // lck.readers = Math.max(20, lck.readers++);
            lckTemp.readers++;
        }
        if (endRead) {
            // in case something weird happens, never let it go below 0.
            lckTemp.readers = Math.max(0, --lckTemp.readers);
        }
        var holderUuid = uuid;
        var timer = null;
        if (ttl !== Infinity) {
            // Set TTL for this specific lock holder
            timer = setTimeout(function () {
                _this.emitter.emit('warning', "lmx broker warning, lock holder timed out after ".concat(ttl, "ms for key => \"").concat(key, "\", uuid => \"").concat(holderUuid, "\""));
                if (_this.locks.has(key)) {
                    var lock = _this.locks.get(key);
                    // Mark that this specific holder timed out (for potential unlock requests)
                    lock.lockholderTimeouts[holderUuid] = true;
                    // Remove only this specific lock holder
                    var hadHolder = lock.lockholders.delete(holderUuid);
                    if (hadHolder) {
                        // If this is a semaphore (max > 1), only handle this specific holder
                        if (lock.max > 1) {
                            // Try to grant the lock to the next waiting client
                            _this.ensureNewLockHolder(lock, { key: key, _uuid: holderUuid });
                        }
                        else {
                            // For exclusive locks, we can still use the force unlock
                            // as there's only one holder anyway
                            _this.unlock({ key: key, force: true, from: 'ttl expired for exclusive lock' });
                        }
                    }
                }
            }, ttl);
        }
        lckTemp.lockholders.set(uuid, { ws: ws, uuid: uuid, pid: pid, timer: timer });
        this.send(ws, {
            readersCount: lckTemp.readers,
            uuid: uuid,
            lockRequestCount: 0,
            key: key,
            type: 'lock',
            acquired: true
        });
    };
    Broker.prototype.unlock = function (data, ws) {
        var key = data.key;
        var uuid = data.uuid;
        var _uuid = data._uuid;
        var force = data.force;
        var rwStatus = data.rwStatus;
        var lck = this.locks.get(key);
        var keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
        exports.log.debug(chalk_1.default.yellow('[BROKER-UNLOCK] unlock called'), { key: key, uuid: uuid, _uuid: _uuid, force: force, hasLock: !!lck, lockholders: lck === null || lck === void 0 ? void 0 : lck.lockholders.size, notifyQueue: lck === null || lck === void 0 ? void 0 : lck.notify.length });
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
        var same = null;
        if (_uuid && lck) {
            same = lck.lockholders.has(_uuid);
            exports.log.debug('same is:', same);
        }
        else if (lck) {
            // Changed to debug to avoid excessive error logs on force unlocks
            exports.log.debug('no _uuid was passed to unlock');
        }
        if (lck && (same || force)) {
            var ln = lck.notify.length;
            if (force) {
                // If this is a semaphore lock and we're just targeting one lock holder,
                // only remove that specific holder
                if (_uuid && lck.max > 1) {
                    // Get the lockholder's information before deleting
                    var lockholder = lck.lockholders.get(_uuid);
                    if (lockholder && lockholder.timer) {
                        clearTimeout(lockholder.timer);
                    }
                    // Just remove this specific lock holder
                    var removed = lck.lockholders.delete(_uuid);
                    if (removed) {
                        lck.lockholdersAllReleased[_uuid] = true;
                    }
                }
                else {
                    // Traditional force behavior - remove all lock holders
                    for (var _i = 0, _a = lck.lockholders.keys(); _i < _a.length; _i++) {
                        var k = _a[_i];
                        var lockholder = lck.lockholders.get(k);
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
                var lockholder = lck.lockholders.get(_uuid);
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
                exports.log.debug(chalk_1.default.yellow('[BROKER-UNLOCK] sending unlock success'), { key: key, uuid: uuid, lockRequestCount: ln, remainingLockholders: lck.lockholders.size, notifyQueue: lck.notify.length });
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
            var ln = lck.notify.length;
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
            this.emitter.emit('warning', "lmx broker warning: no lock with key => '".concat(key, "'."));
            this.send(ws, {
                uuid: uuid,
                key: key,
                lockRequestCount: 0,
                type: 'unlock',
                unlocked: true,
                warning: "no lock with key => \"".concat(key, "\".")
            });
        }
        else if (ws) {
            this.emitter.emit('warning', 'lmx implementation warning: missing uuid (we have a socket connection but no uuid).');
        }
        else {
            this.emitter.emit('warning', 'lmx implementation warning: missing uuid and socket connection.');
        }
    };
    return Broker;
}());
exports.Broker = Broker;
// aliases
exports.LvMtxBroker = Broker;
exports.LMXBroker = Broker;
exports.default = Broker;
