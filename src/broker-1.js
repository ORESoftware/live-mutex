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
exports.LMXBroker = exports.LvMtxBroker = exports.Broker1 = exports.validConstructorOptions = exports.log = void 0;
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
var Broker1 = /** @class */ (function () {
    function Broker1(o, cb) {
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
    Broker1.create = function (opts) {
        return new Broker1(opts);
    };
    Broker1.prototype.emit = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        exports.log.warn('warning:', 'use b.emitter.emit() instead of b.emit()');
        return this.emitter.emit.apply(this.emitter, args);
    };
    Broker1.prototype.on = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        exports.log.warn('warning:', 'use c.emitter.on() instead of c.on()');
        return this.emitter.on.apply(this.emitter, args);
    };
    Broker1.prototype.once = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        exports.log.warn('warning:', 'use c.emitter.once() instead of c.once()');
        return this.emitter.once.apply(this.emitter, args);
    };
    Broker1.prototype.ping = function (data, ws) {
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
    Broker1.prototype.getSystemStats = function (data, ws) {
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
    Broker1.prototype.close = function (cb) {
        // Clean up all timers to prevent memory leaks
        for (var _i = 0, _a = Object.keys(this.timeouts); _i < _a.length; _i++) {
            var key = _a[_i];
            clearTimeout(this.timeouts[key]);
            delete this.timeouts[key];
        }
        // Clean up all lockholder timers
        for (var _b = 0, _c = this.locks; _b < _c.length; _b++) {
            var _d = _c[_b], key = _d[0], lockObj = _d[1];
            for (var _e = 0, _f = lockObj.lockholders.values(); _e < _f.length; _e++) {
                var lockholder = _f[_e];
                if (lockholder.timer) {
                    clearTimeout(lockholder.timer);
                    lockholder.timer = null;
                }
            }
        }
        // Close all client connections
        for (var _g = 0, _h = this.connectedClients; _g < _h.length; _g++) {
            var client = _h[_g];
            try {
                client.destroy();
            }
            catch (err) {
                // ignore errors during cleanup
            }
        }
        this.connectedClients.clear();
        // Close the server
        this.wss.close(cb);
    };
    Broker1.prototype.getListeningInterface = function () {
        return this.socketFile || this.port;
    };
    Broker1.prototype.getVersion = function () {
        return brokerPackage.version;
    };
    Broker1.prototype.getPort = function () {
        return this.port;
    };
    Broker1.prototype.getHost = function () {
        return this.host;
    };
    /**
     * Attach a callback to listen for warning events and output them
     * @param callback Function that receives warning messages/errors
     */
    Broker1.prototype.onWarning = function (callback) {
        this.emitter.on('warning', callback);
    };
    Broker1.prototype.abruptlyDestroyConnection = function (ws) {
        exports.log.error('Connection will be destroyed.');
        ws.destroy();
        ws.removeAllListeners();
    };
    Broker1.prototype.abruptlyEndConnection = function (ws) {
        exports.log.error('Connection will be ended.');
        ws.end();
        ws.removeAllListeners();
    };
    Broker1.prototype.onVersion = function (data, ws) {
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
    Broker1.prototype.cleanupConnection = function (ws) {
        if (ws.lmxClosed === true) {
            return;
        }
        ws.lmxClosed = true;
        this.connectedClients.delete(ws);
        var wsKeys = this.wsToKeys.get(ws);
        this.wsToKeys.delete(ws);
        var uuids = Object.keys(this.wsToUUIDs.get(ws) || {});
        this.wsToUUIDs.delete(ws);
        // Clean up any timeouts for keys associated with this websocket
        if (wsKeys) {
            for (var _i = 0, _a = Object.keys(wsKeys); _i < _a.length; _i++) {
                var key = _a[_i];
                if (this.timeouts[key]) {
                    clearTimeout(this.timeouts[key]);
                    delete this.timeouts[key];
                }
            }
        }
        for (var _b = 0, _c = this.locks; _b < _c.length; _b++) {
            var _d = _c[_b], k = _d[0], lockObj = _d[1];
            var notify = lockObj.notify;
            for (var _e = 0, _f = Object.keys(uuids); _e < _f.length; _e++) {
                var uuid = _f[_e];
                notify.remove(uuid);
            }
            // Clear any timers associated with this websocket, before unlocking
            for (var _g = 0, _h = lockObj.lockholders.values(); _g < _h.length; _g++) {
                var lockholder = _h[_g];
                if (lockholder.ws === ws && lockholder.timer) {
                    clearTimeout(lockholder.timer);
                    lockholder.timer = null;
                }
            }
            if (lockObj.isViaShell !== true) {
                // delete lockObj[k];
                this.unlock({ force: true, key: k, from: 'client socket closed/ended/errored' }, ws);
            }
            else if (!lockObj.keepLocksAfterDeath) {
                this.unlock({ force: true, key: k, from: 'client socket closed/ended/errored' }, ws);
            }
        }
    };
    Broker1.prototype.ls = function (data, ws) {
        return this.send(ws, { ls_result: Object.keys(this.locks), uuid: data.uuid });
    };
    Broker1.prototype.broadcast = function (data, ws) {
        var key = data.key;
        var uuid = data.uuid;
        var v = this.registeredListeners[key] = this.registeredListeners[key] || [];
        exports.log.debug('broadcast: key:', key, 'queued listeners:', v.length);
        var processed = 0;
        while (v.length > 0) {
            var p = v.pop();
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
            // if we call broadcast via broker, ws is null, so check if it exists
            this.send(ws, {
                key: data.key,
                uuid: uuid,
                type: 'broadcast-success'
            });
        }
    };
    Broker1.prototype.incrementReaders = function (data, ws) {
        var key = data.key;
        var uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        var lck = this.locks.get(key);
        exports.log.debug('incrementReaders: key:', key, 'current readers:', lck.readers);
        lck.readers++;
        exports.log.debug('incrementReaders: key:', key, 'new readers count:', lck.readers);
        this.send(ws, {
            key: key,
            uuid: uuid,
            type: 'increment-readers-success'
        });
    };
    Broker1.prototype.setWriteFlagToFalseAndBroadcast = function (data, ws) {
        var _a, _b;
        var key = data.key;
        var uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        var lck = this.locks.get(key);
        exports.log.debug('setWriteFlagToFalseAndBroadcast: key:', key, 'uuid:', uuid, 'current writerFlag:', lck.writerFlag, 'readers:', lck.readers, 'queued listeners:', ((_a = this.registeredListeners[key]) === null || _a === void 0 ? void 0 : _a.length) || 0);
        lck.writerFlag = false;
        exports.log.debug('setWriteFlagToFalseAndBroadcast: writer flag set to false, broadcasting to', ((_b = this.registeredListeners[key]) === null || _b === void 0 ? void 0 : _b.length) || 0, 'queued listeners');
        this.broadcast({ key: key }, null);
        exports.log.debug('setWriteFlagToFalseAndBroadcast: sending success response for key:', key, 'uuid:', uuid);
        this.send(ws, { uuid: uuid, key: key, type: 'write-flag-false-and-broadcast-success' });
        exports.log.debug('setWriteFlagToFalseAndBroadcast: success response sent for key:', key, 'uuid:', uuid);
    };
    Broker1.prototype.decrementReaders = function (data, ws) {
        var _a;
        var key = data.key;
        var uuid = data.uuid;
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        var lck = this.locks.get(key);
        exports.log.debug('decrementReaders: key:', key, 'current readers:', lck.readers);
        var r = lck.readers = Math.max(0, --lck.readers);
        exports.log.debug('decrementReaders: key:', key, 'new readers count:', r);
        if (r < 1) {
            exports.log.debug('decrementReaders: readers are zero, broadcasting to', ((_a = this.registeredListeners[key]) === null || _a === void 0 ? void 0 : _a.length) || 0, 'queued listeners');
            this.broadcast({ key: key }, null);
        }
        exports.log.debug('decrementReaders: sending success response for key:', key, 'uuid:', uuid);
        this.send(ws, {
            key: key,
            uuid: uuid,
            type: 'decrement-readers-success'
        });
        exports.log.debug('decrementReaders: success response sent for key:', key, 'uuid:', uuid);
    };
    Broker1.prototype.registerWriteFlagAndReadersCheck = function (data, ws) {
        var key = data.key;
        var uuid = data.uuid;
        var v = this.registeredListeners[key] = this.registeredListeners[key] || [];
        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }
        var lck = this.locks.get(key);
        var readersCount = lck && lck.readers || 0;
        var writerFlag = lck.writerFlag || false;
        exports.log.debug('registerWriteFlagAndReadersCheck: key:', key, 'writerFlag:', writerFlag, 'readersCount:', readersCount);
        if (writerFlag || readersCount > 1) {
            exports.log.debug('registerWriteFlagAndReadersCheck: queuing write request, current queue length:', v.length);
            return v.push({
                ws: ws,
                key: key,
                uuid: uuid,
                fn: function () {
                    exports.log.debug('registerWriteFlagAndReadersCheck: delayed setting writer flag to true for key:', key);
                    lck.writerFlag = true;
                }
            });
        }
        exports.log.debug('registerWriteFlagAndReadersCheck: setting writer flag to true immediately for key:', key);
        lck.writerFlag = true;
        this.send(ws, {
            readersCount: readersCount,
            writerFlag: writerFlag,
            key: key,
            uuid: uuid,
            type: 'register-write-flag-and-readers-check-success'
        });
    };
    Broker1.prototype.getDefaultLockObject = function (key, keepLocksAfterDeath, max) {
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
    Broker1.prototype.registerWriteFlagCheck = function (data, ws) {
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
        exports.log.debug('registerWriteFlagCheck: key:', key, 'writerFlag:', writerFlag, 'readersCount:', readersCount, 'current queue length:', v.length);
        if (writerFlag) {
            // Writer flag is set, queue this read request to wait for writer to finish
            exports.log.debug('registerWriteFlagCheck: writer flag is set, queuing read request for key:', key);
            v.push({
                ws: ws,
                key: key,
                uuid: uuid,
                fn: function () {
                    exports.log.debug('registerWriteFlagCheck: delayed incrementing readers for key:', key, 'current readers:', lck.readers);
                    lck.readers++;
                    exports.log.debug('registerWriteFlagCheck: readers incremented to:', lck.readers, 'sending success response');
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
            exports.log.debug('registerWriteFlagCheck: sending queued response for key:', key);
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
    Broker1.prototype.inspect = function (data, ws) {
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
    Broker1.prototype.grantLock = function (lck, ws, uuid, pid, ttl, key) {
        var _this = this;
        if (ttl !== Infinity) {
            ttl = we_are_debugging_1.weAreDebugging ? 50000000 : (ttl || this.lockExpiresAfter);
        }
        if (!this.wsToKeys.get(ws)) {
            this.wsToKeys.set(ws, {});
        }
        this.wsToKeys.get(ws)[key] = true;
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
                        _this.ensureNewLockHolder(lock, { key: key, _uuid: uuid });
                    }
                }
            }, ttl);
        }
        lck.lockholders.set(uuid, { pid: pid, uuid: uuid, ws: ws, timer: timer });
    };
    Broker1.prototype.ensureNewLockHolder = function (lck, data) {
        var _this = this;
        var locks = this.locks;
        var notifyList = lck.notify;
        // Remove previous lock holder if _uuid is provided
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
            // Double-check capacity before granting to prevent exceeding max
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
            // Triple-check capacity immediately before granting to prevent race conditions
            if (lck.lockholders.size >= lck.max) {
                // Put this client back in the notify queue
                notifyList.enqueue(n.uuid, n);
                return "break";
            }
            // Found a valid client - grant them the lock
            var ws = n.ws;
            var ttl = n.ttl;
            var uuid = n.uuid;
            this_1.grantLock(lck, ws, uuid, n.pid, ttl, key);
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
            // Clear any existing timeout for this key
            if (this_1.timeouts[key]) {
                clearTimeout(this_1.timeouts[key]);
                delete this_1.timeouts[key];
            }
            // Set timeout for re-election if lock holder doesn't confirm
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
                    var hadHolder = lckTemp.lockholders.delete(uuid);
                    var ln_1 = lckTemp.notify.length;
                    var notifyList_1 = lckTemp.notify;
                    if (hadHolder && !self.rejected[uuid]) {
                        // Re-queue this request if it was removed
                        var lockholder = lckTemp.lockholders.get(uuid);
                        if (!lockholder && !notifyList_1.contains(uuid)) {
                            // Reconstruct the notify object from the lockholder data if available
                            // Otherwise, just trigger re-election for waiting clients
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
                    }
                    // Trigger re-election for waiting clients
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
        // Use a more defensive check to prevent race conditions
        while (notifyList.length > 0) {
            var state_1 = _loop_1();
            if (state_1 === "break")
                break;
        }
    };
    Broker1.prototype.retrieveLockInfo = function (data, ws) {
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
    Broker1.prototype.cleanUpLocks = function () {
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
    Broker1.prototype.lock = function (data, ws) {
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
        this.grantLock(lckTemp, ws, uuid, pid, ttl, key);
        this.send(ws, {
            readersCount: lckTemp.readers,
            uuid: uuid,
            lockRequestCount: 0,
            key: key,
            type: 'lock',
            acquired: true
        });
    };
    Broker1.prototype.unlock = function (data, ws) {
        var key = data.key;
        var uuid = data.uuid;
        var _uuid = data._uuid;
        var force = data.force;
        var lck = this.locks.get(key);
        var keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
        exports.log.debug('unlock: received unlock request for key:', key, 'uuid:', uuid, '_uuid:', _uuid, 'force:', force, 'has lock:', !!lck);
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
            // Get the lockholder's information
            var lockholder = lck.lockholders.get(_uuid);
            if (lockholder && lockholder.timer) {
                clearTimeout(lockholder.timer);
            }
            // remove the lockholder, as the above if stmt checked it,
            //so we don't need to check before deleting it again.
            lck.lockholders.delete(_uuid);
            // delete lck.lockholderTimeouts[_uuid];
            if (force) {
                // If this is a semaphore lock and we're just targeting one lock holder,
                // only remove that specific holder
                if (_uuid && lck.max > 1) {
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
                        lck.lockholdersAllReleased[k] = true;
                    }
                    lck.lockholders = new Map();
                }
            }
            if (uuid && ws) {
                // if no uuid is defined, then unlock was called by something other than the client
                // aka this library called unlock when there was a timeout
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
    return Broker1;
}());
exports.Broker1 = Broker1;
// aliases
exports.LvMtxBroker = Broker1;
exports.LMXBroker = Broker1;
exports.default = Broker1;
