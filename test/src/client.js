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
exports.LvMtxClient = exports.LMXClient = exports.Client = exports.validUnlockOptions = exports.validLockOptions = exports.validConstructorOptions = void 0;
//core
const util = __importStar(require("util"));
const assert = __importStar(require("assert"));
const net = __importStar(require("net"));
//npm
const UUID = require("uuid");
const chalk_1 = __importDefault(require("chalk"));
//project
const json_parser_1 = require("./json-parser");
const cu = __importStar(require("./client-utils"));
const clientPackage = require('../package.json');
if (!(clientPackage.version && typeof clientPackage.version === 'string')) {
    throw new Error('Client NPM package did not have a top-level field that is a string.');
}
const PromiseSymbol = Symbol('is promise method');
const we_are_debugging_1 = require("./we-are-debugging");
const events_1 = require("events");
const path = __importStar(require("path"));
const shared_internal_1 = require("./shared-internal");
const exceptions_1 = require("./exceptions");
const exceptions_2 = require("./exceptions");
const shared_internal_2 = require("./shared-internal");
const shared_internal_3 = require("./shared-internal");
const client_utils_1 = require("./client-utils");
if (we_are_debugging_1.weAreDebugging) {
    client_utils_1.log.debug('lmx client is in debug mode. Timeouts are turned off.');
}
exports.validConstructorOptions = {
    key: 'string',
    listener: 'function',
    connectTimeout: 'integer (in millis)',
    host: 'string',
    port: 'integer',
    ttl: 'integer (in millis)',
    unlockRequestTimeout: 'integer (in millis)',
    lockRequestTimeout: 'integer (in millis)',
    lockRetryMax: 'integer',
    keepLocksAfterDeath: 'boolean (if the client process exits, the broker keeps the relevant locks locked.)',
    keepLocksOnExit: 'boolean ()',
    noDelay: 'boolean (the tcp protocol "no delay" option)',
    udsPath: 'string (an absolute file path)'
};
exports.validLockOptions = {
    force: 'boolean',
    maxRetries: 'integer',
    maxRetry: 'integer',
    ttl: 'integer (in millis)',
    lockRequestTimeout: 'integer (in millis)',
    keepLocksAfterDeath: 'boolean',
    keepLocksOnExit: 'boolean'
};
exports.validUnlockOptions = {
    force: 'boolean',
    unlockRequestTimeout: 'integer',
    keepLocksAfterDeath: 'boolean'
};
class Client {
    constructor(o, cb) {
        this.port = 6970;
        this.host = 'localhost';
        this.connectTimeout = 3000;
        this.ws = null;
        this.cannotContinue = false;
        this.keepLocksAfterDeath = false;
        this.keepLocksOnExit = false;
        this.emitter = new events_1.EventEmitter();
        this.noDelay = true;
        this.socketFile = '';
        this.recovering = false;
        this.isOpen = false;
        const opts = this.opts = o || {};
        assert.strict(typeof opts === 'object', 'Bad arguments to lmx client constructor - options must be an object.');
        if (cb) {
            assert.strict(typeof cb === 'function', 'optional second argument to lmx Client constructor must be a function.');
        }
        for (const key of Object.keys(opts)) {
            if (!exports.validConstructorOptions[key]) {
                throw new Error('An option passed to lmx Client constructor is ' +
                    `not a recognized option => "${key}", \n valid options are: ` + util.inspect(exports.validConstructorOptions));
            }
        }
        if ('host' in opts && opts.host !== undefined) {
            assert.strict(typeof opts.host === 'string', 'lmx: "host" option needs to be a string.');
            this.host = opts.host;
        }
        if ('port' in opts && opts.port !== undefined) {
            assert.strict(Number.isInteger(opts.port), cu.getClientErrorMessage(`the "port" option needs to be an integer.`));
            assert.strict(opts.port >= 80 && opts.port < 49152, cu.getClientErrorMessage('the "port" option needs to be an integer in the range (1025-49151).'));
            this.port = opts.port;
        }
        if ('listener' in opts && opts.listener !== undefined) {
            assert.strict(typeof opts.listener === 'function', cu.getClientErrorMessage('the "listener" option should be a function.'));
            assert.strict(typeof opts.key === 'string', cu.getClientErrorMessage('you must pass in a key to use listener functionality.'));
        }
        if ('connectTimeout' in opts && opts.connectTimeout !== undefined) {
            assert.strict(Number.isInteger(opts.connectTimeout), cu.getClientErrorMessage('the "connectTimeout" option must be an integer.'));
            assert.strict(opts.connectTimeout > 10 && opts.connectTimeout < 20000, cu.getClientErrorMessage('the "connectTimeout" option must be between 10 and 20000 ms.'));
            this.connectTimeout = opts.connectTimeout;
        }
        if ('lockRetryMax' in opts && opts.lockRetryMax !== undefined) {
            assert.strict(Number.isInteger(opts.lockRetryMax), cu.getClientErrorMessage('the "lockRetryMax" option needs to be an integer.'));
            assert.strict(opts.lockRetryMax >= 0 && opts.lockRetryMax <= 100, cu.getClientErrorMessage('the "lockRetryMax" integer needs to be in range (0-100).'));
        }
        if (opts['retryMax']) {
            assert.strict(Number.isInteger(opts.retryMax), cu.getClientErrorMessage('the "retryMax" option needs to be an integer.'));
            assert.strict(opts.retryMax >= 0 && opts.retryMax <= 100, cu.getClientErrorMessage('the "retryMax" integer needs to be in range (0-100).'));
        }
        if (opts['unlockRequestTimeout']) {
            assert.strict(Number.isInteger(opts.unlockRequestTimeout), cu.getClientErrorMessage('the "unlockRequestTimeout" option needs to be an integer (representing milliseconds).'));
            assert.strict(opts.unlockRequestTimeout >= 20 && opts.unlockRequestTimeout <= 800000, cu.getClientErrorMessage('the "unlockRequestTimeout" needs to be integer between 20 and 800000 millis.'));
        }
        if (opts['lockRequestTimeout']) {
            assert.strict(Number.isInteger(opts.lockRequestTimeout), cu.getClientErrorMessage('the "lockRequestTimeout" option needs to be an integer (representing milliseconds).'));
            assert.strict(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000, cu.getClientErrorMessage('the "lockRequestTimeout" needs to be integer between 20 and 800000 millis.'));
        }
        if (opts['ttl']) {
            assert.strict(Number.isInteger(opts.ttl), cu.getClientErrorMessage('the "ttl" option needs to be an integer (representing milliseconds).'));
            assert.strict(opts.ttl >= 3 && opts.ttl <= 800000, cu.getClientErrorMessage('the "ttl" needs to be integer between 3 and 800000 millis.'));
        }
        if ('keepLocksAfterDeath' in opts) {
            assert.strict(typeof opts.keepLocksAfterDeath === 'boolean', cu.getClientErrorMessage('the "keepLocksAfterDeath" option needs to be a boolean.'));
        }
        if ('keepLocksOnExit' in opts) {
            assert.strict(typeof opts.keepLocksOnExit === 'boolean', cu.getClientErrorMessage('the "keepLocksOnExit" option needs to be a boolean.'));
        }
        if (opts.ttl === null) {
            opts.ttl = Infinity;
        }
        if ('noDelay' in opts && opts['noDelay'] !== undefined) {
            assert.strict(typeof opts.noDelay === 'boolean', 'lmx: "noDelay" option needs to be an integer => ' + opts.noDelay);
            this.noDelay = opts.noDelay;
        }
        if ('udsPath' in opts && opts['udsPath'] !== undefined) {
            assert.strict(typeof opts.udsPath === 'string', '"udsPath" option must be a string.');
            assert.strict(path.isAbsolute(opts.udsPath), '"udsPath" option must be an absolute path.');
            this.socketFile = path.resolve(opts.udsPath);
        }
        this.keepLocksAfterDeath = Boolean(opts.keepLocksAfterDeath || opts.keepLocksOnExit);
        this.listeners = {};
        this.ttl = we_are_debugging_1.weAreDebugging ? 5000000 : (opts.ttl || 7050);
        this.unlockRequestTimeout = we_are_debugging_1.weAreDebugging ? 5000000 : (opts.unlockRequestTimeout || 8000);
        this.lockRequestTimeout = we_are_debugging_1.weAreDebugging ? 5000000 : (opts.lockRequestTimeout || 3000);
        this.lockRetryMax = opts.lockRetryMax || opts.maxRetries || opts.retryMax || 3;
        let ws = null;
        let connectPromise = null;
        const self = this;
        this.emitter.on('warning', function () {
            if (self.emitter.listenerCount('warning') < 2) {
                client_utils_1.log.warn('No "warning" event handler(s) attached by end-user to client.emitter, therefore logging these errors from LMX library:');
                client_utils_1.log.warn(...Array.from(arguments).map(v => (typeof v === 'string' ? v : util.inspect(v))));
                client_utils_1.log.warn('Add a "warning" event listener to the lmx client to get rid of this message.');
            }
        });
        this.write = (data, cb) => {
            if (!ws) {
                throw new Error('please call ensure()/connect() on this lmx client, before using the lock/unlock methods.');
            }
            if (!ws.writable) {
                return this.ensure((err, val) => {
                    if (err) {
                        throw new Error('Could not reconnect.');
                    }
                    this.write(data, cb);
                });
            }
            data.max = data.max || null;
            data.pid = process.pid;
            if (data.ttl === Infinity) {
                data.ttl = null;
            }
            if ('keepLocksAfterDeath' in data) {
                data.keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
            }
            else {
                data.keepLocksAfterDeath = this.keepLocksAfterDeath || false;
            }
            ws.write(JSON.stringify(data) + '\n', 'utf8', cb);
        };
        const onData = (data) => {
            const uuid = data.uuid;
            const _uuid = data._uuid;
            if (!(data && typeof data === 'object')) {
                return this.emitter.emit('error', 'Internal error -> data was not an object.');
            }
            if (data.error) {
                this.emitter.emit('error', data.error);
            }
            if (data.warning) {
                this.emitter.emit('warning', data.warning);
            }
            if (data.type === 'version-mismatch') {
                this.emitter.emit('error', data);
                client_utils_1.log.error(data);
                this.cannotContinue = true;
                this.write({ type: 'version-mismatch-confirmed' });
                this._fireCallbacksPrematurely(new Error('lmx version-match:' + util.inspect(data)));
                return;
            }
            if (!uuid) {
                return this.emitter.emit('warning', 'Potential lmx implementation error => message did not contain uuid =>' + util.inspect(data));
            }
            const fn = this.resolutions[uuid];
            const to = this.timeouts[uuid];
            // Debug logging for RW lock operations
            if (data.type && (data.type.includes('readers') || data.type.includes('write-flag') || data.type.includes('register'))) {
                client_utils_1.log.debug(chalk_1.default.yellow('[CLIENT] Received RW message'), { uuid, type: data.type, key: data.key, hasFn: !!fn, hasTimeout: !!to });
            }
            delete this.timeouts[uuid];
            // delete self.resolutions[uuid]; // don't do this here, the same resolution fn might need to be called more than once
            if (this.giveups[uuid]) {
                client_utils_1.log.debug(chalk_1.default.yellow('[CLIENT] Request was given up'), { uuid, type: data.type });
                clearTimeout(this.timers[uuid]);
                delete this.giveups[uuid];
                delete this.resolutions[uuid];
                return;
            }
            if (fn && to) {
                this.emitter.emit('error', 'lmx implementation error - resolution function and timeout both exist.');
            }
            if (to) {
                client_utils_1.log.debug(chalk_1.default.yellow('[CLIENT] Request timed out'), { uuid, type: data.type });
                this.emitter.emit('warning', 'Client side lock/unlock request timed-out.');
                if (data.acquired === true && data.type === 'lock') {
                    self.write({ uuid: uuid, _uuid, key: data.key, type: 'lock-received-rejected' });
                }
                return;
            }
            if (fn) {
                client_utils_1.log.debug(chalk_1.default.cyan('onData: calling resolution function for uuid:'), uuid, 'type:', data?.type);
                fn.call(this, data.error, data);
                return;
            }
            client_utils_1.log.debug(chalk_1.default.yellow('onData: no resolution function found for uuid:'), uuid, 'type:', data?.type);
            this.emitter.emit('warning', 'lmx implementation warning, ' +
                'no fn with that uuid in the resolutions hash => ' + util.inspect(data, { breakLength: Infinity }));
            if (data.acquired === true && data.type === 'lock') {
                // this most likely occurs when a retry request gets sent before the previous lock request gets resolved
                this.emitter.emit('warning', `Rejecting lock acquisition for key => "${data.key}".`);
                this.write({
                    uuid: uuid,
                    key: data.key,
                    type: 'lock-received-rejected'
                });
            }
        };
        this.ensure = this.connect = (cb) => {
            if (cb) {
                assert.strict(typeof cb === 'function', 'Optional argument to ensure/connect must be a function.');
                if (process.domain) {
                    cb = process.domain.bind(cb);
                }
            }
            if (!this.recovering && (connectPromise && ws && ws.writable)) { // && self.isOpen
                return connectPromise.then((val) => {
                    cb && cb.call(self, null, val);
                    return val;
                }, function (err) {
                    cb && cb.call(self, err);
                    return Promise.reject(err);
                });
            }
            this.recovering = false;
            if (ws) {
                try {
                    ws.destroy();
                }
                finally {
                    ws.removeAllListeners();
                }
            }
            return connectPromise = new Promise((resolve, reject) => {
                const onFirstErr = (e) => {
                    this.noRecover = true;
                    const err = 'lmx client error: ' + (0, shared_internal_3.inspectError)(e);
                    this.emitter.emit('warning', err);
                    reject(err);
                };
                const to = setTimeout(function () {
                    reject('lmx client err: client connection timeout after 3000ms.');
                }, this.connectTimeout);
                const cnkt = self.socketFile ? [self.socketFile] : [self.port, self.host];
                if (self.socketFile && opts.port) {
                    client_utils_1.log.fatal('a "port" option was provided along with "socketFile" option, please pick one.');
                }
                // @ts-ignore
                ws = net.createConnection(...cnkt, () => {
                    self.isOpen = true;
                    clearTimeout(to);
                    ws.removeListener('error', onFirstErr);
                    this.write({ type: 'version', value: clientPackage.version });
                    resolve(this);
                });
                if (self.noDelay) {
                    ws.setNoDelay(true);
                }
                let called = false;
                const recover = (e) => {
                    if (called) {
                        return;
                    }
                    called = true;
                    if (this.noRecover) {
                        return;
                    }
                    this.recovering = true;
                    e && this.emitter.emit('warning', 'lmx client error: ' + (0, shared_internal_3.inspectError)(e));
                    if (!ws.destroyed) {
                        ws.destroy();
                        ws.removeAllListeners();
                    }
                    for (const [k, v] of Object.entries(this.resolutions)) {
                        this.giveups[k] = true;
                        clearTimeout(this.timers[k]);
                        v('lmx connection ended/closed. ' +
                            'A new connection will be created but all locking requests' +
                            ' in-flight should get receive errors in the callbacks.', {});
                    }
                    // create new connection
                    this.ensure().then(() => {
                        client_utils_1.log.debug('new connection created, via recover routine.');
                    });
                };
                ws.setEncoding('utf8')
                    .once('error', onFirstErr)
                    .once('close', () => {
                    this.emitter.emit('warning', 'lmx client stream "close" event occurred.');
                    recover(null);
                })
                    .once('end', () => {
                    this.emitter.emit('warning', 'lmx client stream "end" event occurred.');
                    recover(null);
                })
                    .on('error', (e) => {
                    this.emitter.emit('warning', 'lmx client stream "error" event occurred: ' + (0, shared_internal_3.inspectError)(e));
                    recover(e);
                })
                    .pipe((0, json_parser_1.createParser)())
                    .on('data', onData);
            })
                // if the user passes a callback, we fire the callback here
                .then(val => {
                cb && cb.call(self, null, val);
                return val;
            }, err => {
                cb && cb.call(self, err);
                return Promise.reject(err);
            });
        };
        // Don't add process listeners per client instance to avoid memory leaks
        // Connection cleanup is handled in close() and cleanupConnection methods
        this.endCurrentConnection = () => {
            return ws && ws.end();
        };
        this.close = () => {
            this.noRecover = true;
            // Clean up all timers to prevent memory leaks
            for (const k of Object.keys(this.timers)) {
                clearTimeout(this.timers[k]);
            }
            this.timers = {};
            // Clean up all timeouts
            this.timeouts = {};
            // Clean up resolutions
            this.resolutions = {};
            // Clean up giveups
            this.giveups = {};
            // Remove all event listeners from emitter
            this.emitter.removeAllListeners();
            // Destroy socket and remove its listeners
            if (ws) {
                ws.removeAllListeners();
                ws.destroy();
            }
            return ws;
        };
        this.createNewConnection = () => {
            return ws && ws.destroy();
        };
        this.timeouts = {};
        this.resolutions = {};
        this.giveups = {};
        this.timers = {};
        // if the user passes a callback, we call connect here
        // on behalf of the user
        cb && this.connect(cb);
    }
    ;
    onSocketDestroy(err) {
        client_utils_1.log.info('Socket destroy callback error:', err);
    }
    static create(opts) {
        return new Client(opts);
    }
    getConnectionInterface() {
        return this.socketFile || this.port;
    }
    getConnectionInterfaceStr() {
        return this.socketFile ? `socket-file: ${this.socketFile}` : `host:port '${this.getHost()}:${this.getPort()}'`;
    }
    _fireCallbacksPrematurely(originalErr) {
        for (const k of Object.keys(this.timers)) {
            clearTimeout(this.timers[k]);
        }
        this.timers = {};
        const err = new Error('Unknown error - firing resolution callbacks prematurely.');
        for (let k of Object.keys(this.resolutions)) {
            const fn = this.resolutions[k];
            delete this.resolutions[k];
            const e = {
                message: err.message,
                stack: err.stack,
                forcePrematureCallback: true,
                originalErrorString: (0, shared_internal_3.inspectError)(err)
            };
            fn.call(this, e, e);
        }
    }
    setNoRecover() {
        this.noRecover = true;
    }
    requestLockInfo(key, opts, cb) {
        assert.equal(typeof key, 'string', 'Key passed to lmx#lock needs to be a string.');
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        opts = opts || {};
        const uuid = opts._uuid || UUID.v4();
        this.resolutions[uuid] = (err, data) => {
            clearTimeout(this.timers[uuid]);
            delete this.timeouts[uuid];
            if (err) {
                return this.fireCallbackWithError(cb, false, new exceptions_2.LMXClientException(key, null, shared_internal_2.LMXClientError.UnknownError, err, `Unknown error - see included "originalError" object.)`));
            }
            if (String(key) !== String(data.key)) {
                delete this.resolutions[uuid];
                throw new Error('lmx implementation error => bad key.');
            }
            if (data.error) {
                this.emitter.emit('warning', data.error);
            }
            if ([data.acquired, data.retry].filter(Boolean).length > 1) {
                throw new Error('lmx implementation error, both "acquired" and "retry" options provided, there can be only one.');
            }
            if (data.lockInfo === true) {
                delete this.resolutions[uuid];
                cb(null, { data });
            }
        };
        this.write({
            uuid: uuid,
            key: key,
            type: 'lock-info-request',
        });
    }
    acquire(key, opts) {
        return new Promise((resolve, reject) => {
            try {
                [key, opts] = this.preParseLockOptsForPromises(key, opts);
            }
            catch (err) {
                return reject(err);
            }
            this.lock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    release(key, opts) {
        return new Promise((resolve, reject) => {
            try {
                [key, opts] = this.preParseUnlockOptsForPromise(key, opts);
            }
            catch (err) {
                return reject(err);
            }
            this.unlock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    lockp(key, opts) {
        client_utils_1.log.warn('lockp is deprecated because it is a confusing method name, use aliases acquire/acquireLock instead.');
        return this.acquire.apply(this, arguments);
    }
    unlockp(key, opts) {
        client_utils_1.log.warn('unlockp is deprecated because it is a confusing method name, use aliases release/releaseLock instead.');
        return this.release.apply(this, arguments);
    }
    acquireLock(key, opts) {
        return this.acquire.apply(this, arguments);
    }
    releaseLock(key, opts) {
        return this.release.apply(this, arguments);
    }
    run(fn) {
        return new Promise((resolve, reject) => {
            fn((err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    runUnlock(fn) {
        return this.run.apply(this, arguments);
    }
    execUnlock(fn) {
        return this.run.apply(this, arguments);
    }
    cleanUp(uuid) {
        clearTimeout(this.timers[uuid]);
        delete this.timers[uuid];
        delete this.timeouts[uuid];
        delete this.resolutions[uuid];
    }
    fireUnlockCallbackWithError(cb, isNextTick, err) {
        const uuid = err.id;
        const key = err.key; // unused
        this.cleanUp(uuid);
        this.emitter.emit('warning', err.message);
        if (isNextTick) {
            process.nextTick(cb, err, {}); // need to pass empty object in case the user uses an object destructure call
        }
        else {
            cb(err, {}); // need to pass empty object in case the user uses an object destructure call
        }
    }
    fireLockCallbackWithError(cb, isNextTick, err) {
        const uuid = err.id;
        const key = err.key; // unused
        this.cleanUp(uuid);
        this.emitter.emit('warning', err.message);
        if (isNextTick) {
            process.nextTick(cb, err, {}); // need to pass empty object in case the user uses an object destructure call
        }
        else {
            cb(err, {}); // need to pass empty object in case the user uses an object destructure call
        }
    }
    fireCallbackWithError(cb, isNextTick, err) {
        const uuid = err.id;
        const key = err.key; // unused
        this.cleanUp(uuid);
        this.emitter.emit('warning', err.message);
        if (isNextTick) {
            process.nextTick(cb, err, {}); // need to pass empty object in case the user uses an object destructure call
        }
        else {
            cb(err, {}); // need to pass empty object in case the user uses an object destructure call
        }
    }
    ls(opts, cb) {
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        if (typeof cb !== 'function') {
            throw new Error('Callback needs to be a function type.');
        }
        opts = opts || {};
        const id = UUID.v4();
        this.resolutions[id] = cb;
        this.write({
            keepLocksAfterDeath: opts.keepLocksAfterDeath,
            uuid: id,
            type: 'ls',
        });
    }
    preParseLockOptsForPromises(key, opts) {
        if (typeof opts === 'boolean') {
            opts = { force: opts };
        }
        else if (typeof opts === 'number') {
            opts = { ttl: opts };
        }
        opts = opts || {};
        opts[PromiseSymbol] = true;
        return [key, opts];
    }
    parseLockOpts(key, opts, cb) {
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        else if (typeof opts === 'boolean') {
            opts = { force: opts };
        }
        else if (typeof opts === 'number') {
            opts = { ttl: opts };
        }
        assert.strict(typeof cb === 'function', 'Please use a callback as the last argument to the lock method.');
        opts = opts || {};
        return [key, opts, cb];
    }
    _simulateVersionMismatch() {
        this.write({
            type: 'simulate-version-mismatch',
        });
    }
    _invokeBrokerSideEndCall() {
        this.write({
            type: 'end-connection-from-broker-for-testing-purposes'
        });
    }
    _invokeBrokerSideDestroyCall() {
        this.write({
            type: 'destroy-connection-from-broker-for-testing-purposes'
        });
    }
    _makeClientSideError() {
        this.close();
    }
    lock(key, opts, cb) {
        try {
            [key, opts, cb] = this.parseLockOpts(key, opts, cb);
        }
        catch (err) {
            if (typeof cb === 'function') {
                return process.nextTick(cb, err, {});
            }
            client_utils_1.log.error('No callback was passed to accept the following error.', 'Please include a callback as the final argument to the client.lock() routine.');
            throw err;
        }
        try {
            assert.equal(typeof key, 'string', 'Key passed to lmx #lock needs to be a string.');
            assert.strict(typeof cb === 'function', 'callback function must be passed to Client lock() method; use lockp() or acquire() for promise API.');
            if ('max' in opts) {
                assert.strict(Number.isInteger(opts['max']), '"max" options property must be a positive integer.');
                assert.strict(opts['max'] > 0, '"max" options property must be a positive integer.');
            }
            if ('semaphore' in opts) {
                assert.strict(Number.isInteger(opts['semaphore']), '"semaphore" options property must be a positive integer.');
                assert.strict(opts['semaphore'] > 0, '"semaphore" options property must be a positive integer.');
            }
            if ('force' in opts) {
                assert.equal(typeof opts.force, 'boolean', 'lmx usage error => ' +
                    '"force" option must be a boolean value. Coerce it on your side, for safety.');
            }
            if ('retry' in opts) {
                assert.equal(typeof opts.retry, 'boolean', 'lmx usage error => ' +
                    '"retry" option must be a boolean value. Coerce it on your side, for safety.');
                opts.__maxRetries = 0;
            }
            if ('maxRetries' in opts) {
                assert.strict(Number.isInteger(opts.maxRetries), '"maxRetries" option must be an integer.');
                assert.strict(opts.maxRetries >= 0 && opts.maxRetries <= 20, '"maxRetries" option must be an integer between 0 and 20 inclusive.');
                if ('__maxRetries' in opts) {
                    assert.strictEqual(opts.__maxRetries, opts.maxRetries, 'maxRetries values do not match.');
                }
                opts.__maxRetries = opts.maxRetries;
            }
            if ('maxRetry' in opts) {
                assert.strict(Number.isInteger(opts.maxRetry), '"maxRetry" option must be an integer.');
                assert.strict(opts.maxRetry >= 0 && opts.maxRetry <= 20, '"maxRetry" option must be an integer between 0 and 20 inclusive.');
                if ('__maxRetries' in opts) {
                    assert.strictEqual(opts.__maxRetries, opts.maxRetry, 'maxRetries values do not match.');
                }
                opts.__maxRetries = opts.maxRetry;
            }
            if ('retryMax' in opts) {
                assert.strict(Number.isInteger(opts.retryMax), '"retryMax" option must be an integer.');
                assert.strict(opts.retryMax >= 0 && opts.retryMax <= 20, '"retryMax" option must be an integer between 0 and 20 inclusive.');
                if ('__maxRetries' in opts) {
                    assert.strictEqual(opts.__maxRetries, opts.retryMax, 'maxRetries values do not match.');
                }
                opts.__maxRetries = opts.retryMax;
            }
            if (!('__maxRetries' in opts)) {
                opts.__maxRetries = this.lockRetryMax;
            }
            assert.strict(Number.isInteger(opts.__maxRetries), '__maxRetries value must be an integer.');
            if (opts['ttl']) {
                assert.strict(Number.isInteger(opts.ttl), 'lmx usage error => Please pass an integer representing milliseconds as the value for "ttl".');
                assert.strict(opts.ttl >= 3 && opts.ttl <= 800000, 'lmx usage error => "ttl" for a lock needs to be integer between 3 and 800000 millis.');
            }
            if (opts['ttl'] === null) {
                // allow ttl to be stringified, null or Infinity both mean there is no ttl
                opts['ttl'] = Infinity;
            }
            if (opts['lockRequestTimeout']) {
                assert.strict(Number.isInteger(opts.lockRequestTimeout), 'lmx: Please pass an integer representing milliseconds as the value for "ttl".');
                assert.strict(opts.lockRequestTimeout >= 20 && opts.lockRequestTimeout <= 800000, 'lmx: "ttl" for a lock needs to be integer between 3 and 800000 millis.');
            }
            opts.__retryCount = opts.__retryCount || 0;
            if (opts.__retryCount > 0) {
                assert.strict(opts._uuid, 'lmx internal error: no _uuid past to retry call.');
            }
        }
        catch (err) {
            if (typeof cb === 'function') {
                return process.nextTick(cb, err, {});
            }
            client_utils_1.log.error('No callback was passed to accept the following error.', 'Please include a callback as the final argument to the client.lock() routine.');
            throw err;
        }
        if (process.domain) {
            // @ts-ignore - process.domain.bind changes function signature but preserves runtime behavior
            cb = process.domain.bind(cb);
        }
        this.lockInternal(key, opts, cb);
    }
    on() {
        client_utils_1.log.warn('warning:', 'use c.emitter.on() instead of c.on()');
        return this.emitter.on.apply(this.emitter, arguments);
    }
    once() {
        client_utils_1.log.warn('warning:', 'use c.emitter.once() instead of c.once()');
        return this.emitter.once.apply(this.emitter, arguments);
    }
    lockInternal(key, opts, cb) {
        const uuid = opts._uuid = opts._uuid || UUID.v4();
        const ttl = opts.ttl || this.ttl;
        const lrt = opts.lockRequestTimeout || this.lockRequestTimeout;
        const maxRetries = opts.__maxRetries;
        const retryCount = opts.__retryCount;
        const forceUnlock = opts.forceUnlock === true;
        const isNextTick = !opts[PromiseSymbol] && retryCount < 1;
        if (!this.isOpen) {
            return this.fireLockCallbackWithError(cb, isNextTick, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.ConnectionClosed, `Connection was closed (and/or a client connection error occurred.)`));
        }
        if (this.recovering) {
            return this.fireLockCallbackWithError(cb, isNextTick, new exceptions_1.LMXClientLockException(key, null, shared_internal_1.LMXLockRequestError.ConnectionRecovering, `Connection is recovering - re-connection in progress.`));
        }
        if (this.cannotContinue) {
            return this.fireLockCallbackWithError(cb, isNextTick, new exceptions_1.LMXClientLockException(key, null, shared_internal_1.LMXLockRequestError.CannotContinue, `'Client cannot make any lock requests, most likely due to version mismatch between client and broker.'`));
        }
        if (retryCount >= maxRetries) {
            return this.fireLockCallbackWithError(cb, isNextTick, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.MaxRetries, `Maximum retries (${maxRetries}) attempted to acquire lock for key "${key}".`));
        }
        const rwStatus = opts.rwStatus || null;
        const max = opts.max;
        let timedOut = false;
        this.timers[uuid] = setTimeout(() => {
            timedOut = true;
            delete this.timers[uuid];
            delete this.resolutions[uuid];
            const currentRetryCount = opts.__retryCount;
            const newRetryCount = ++opts.__retryCount;
            if (!this.isOpen) {
                this.timeouts[uuid] = true;
                this.write({ uuid, key, type: 'lock-client-error' });
                return this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.ConnectionClosed, `Connection was closed (and/or a client connection error occurred.)`));
            }
            // noRetry
            if (newRetryCount >= maxRetries) {
                this.timeouts[uuid] = true;
                this.write({ uuid, key, type: 'lock-client-timeout' });
                return this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.RequestTimeoutError, `lmx client lock request timed out after ${lrt * opts.__retryCount} ms, ` +
                    `${currentRetryCount} retries attempted to acquire lock for key "${key}".`));
            }
            this.emitter.emit('warning', `retrying lock request for key '${key}', on ${this.getConnectionInterfaceStr()}, ` +
                `retry attempt # ${newRetryCount}`);
            // this has to be called synchronously,
            // so we can get a new resolution callback on the books
            this.lockInternal(key, opts, cb);
        }, lrt);
        this.resolutions[uuid] = (err, data) => {
            if (timedOut) {
                return;
            }
            if (err) {
                return this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.UnknownException, 'Unknown lmx client exception: ' + util.inspect(err)));
            }
            if (!data) {
                return this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.InternalError, 'LMX inernal error: no data received from broker in client lock resolution callback.'));
            }
            if (data.uuid !== uuid) {
                return this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.InternalError, `Internal lmx error, mismatch in uuids => '${data.uuid}', -> '${uuid}'.`));
            }
            if (String(key) !== String(data.key)) {
                return this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.InternalError, `lmx internal error: bad key, [1] => '${key}', [2] => '${data.key}'.`));
            }
            if (data.error) {
                return this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.GenericLockError, data.error));
            }
            if (data.acquired === true) {
                // lock was acquired for the given key, yippee
                this.cleanUp(uuid);
                this.write({ uuid, key, type: 'lock-received' }); // we let the broker know that we received the lock
                const boundUnlock = this.unlock.bind(this, key, { _uuid: uuid, rwStatus, force: forceUnlock });
                boundUnlock.acquired = true;
                boundUnlock.readersCount = Number.isInteger(data.readersCount) ? data.readersCount : null;
                boundUnlock.key = key;
                boundUnlock.unlock = boundUnlock.release = boundUnlock;
                boundUnlock.lockUuid = boundUnlock.id = uuid;
                return cb(null, boundUnlock);
            }
            if (data.reelection === true) {
                this.cleanUp(uuid);
                return this.lockInternal(key, opts, cb);
            }
            if (data.acquired === false) {
                // if acquired is false, we will:
                // 1. be waiting for acquired to be true
                // 2. if the timeout occurs before 1, we will make a new request and put our request at the front of the queue
                // however, if wait is false, we will do neither 1 or 2
                if (opts.wait === false) {
                    // when wait is false, user only wants to try once,
                    // and doesn't even want to wait until the timeout elapses.
                    // such that even if wait === false and maxRetries === 1,
                    // we still wouldn't wait for the timeout to elapse
                    this.giveups[uuid] = true;
                    this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.WaitOptionSetToFalse, 'Could not acquire lock on first attempt, and "wait" option is false.'));
                }
                return;
            }
            this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, uuid, shared_internal_1.LMXLockRequestError.InternalError, `Implementation error, please report, fallthrough in condition [1]`));
        };
        {
            let keepLocksAfterDeath = Boolean(opts.keepLocksAfterDeath || opts.keepLocksOnExit);
            this.write({
                keepLocksAfterDeath,
                retryCount,
                uuid: uuid,
                key: key,
                type: 'lock',
                ttl: ttl,
                rwStatus,
                max
            });
        }
    }
    noop(err) {
        // this is a no-operation, obviously
        // no ref to this, so can't use "this" here
        err && client_utils_1.log.error(err);
    }
    getPort() {
        return this.port;
    }
    getHost() {
        return this.host;
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
    preParseUnlockOptsForPromise(key, opts) {
        if (typeof opts === 'boolean') {
            opts = { force: opts };
        }
        else if (typeof opts === 'string') {
            opts = { _uuid: opts };
        }
        opts = opts || {};
        opts[PromiseSymbol] = true;
        return [key, opts];
    }
    parseUnlockOpts(key, opts, cb) {
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        else if (typeof opts === 'boolean') {
            opts = { force: opts };
        }
        else if (typeof opts === 'string') {
            opts = { _uuid: opts };
        }
        opts = opts || {};
        if (cb) {
            assert.strict(typeof cb === 'function', 'Please use a callback as the last argument to the client unlock method.');
        }
        else {
            cb = this.noop;
        }
        return [key, opts, cb];
    }
    unlock(key, opts, cb) {
        try {
            [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
        }
        catch (err) {
            if (typeof cb === 'function') {
                return process.nextTick(cb, err, {});
            }
            client_utils_1.log.error('No callback was passed to accept the following error.');
            throw err;
        }
        if (opts.id) {
            opts._uuid = opts.id;
        }
        if (cb && cb !== this.noop) {
            if (process.domain) {
                // @ts-ignore - process.domain.bind changes function signature but preserves runtime behavior
                cb = process.domain.bind(cb);
            }
        }
        cb = cb || this.noop;
        try {
            assert.equal(typeof key, 'string', 'Key passed to lmx #unlock needs to be a string.');
            if (opts['force']) {
                assert.equal(typeof opts.force, 'boolean', 'lmx usage error => ' +
                    '"force" option must be a boolean value. Coerce it on your side, for safety.');
            }
            if (opts['unlockRequestTimeout']) {
                assert.strict(Number.isInteger(opts.unlockRequestTimeout), 'lmx: Please pass an integer representing milliseconds as the value for "ttl".');
                assert.strict(opts.unlockRequestTimeout >= 20 && opts.unlockRequestTimeout <= 800000, 'lmx: "ttl" for a lock needs to be integer between 3 and 800000 millis.');
            }
        }
        catch (err) {
            return process.nextTick(cb, err, {});
        }
        const uuid = UUID.v4();
        const rwStatus = opts.rwStatus || null;
        const urt = opts.unlockRequestTimeout || this.unlockRequestTimeout;
        let timedOut = false;
        this.timers[uuid] = setTimeout(() => {
            timedOut = true;
            this.timeouts[uuid] = true;
            this.fireUnlockCallbackWithError(cb, false, new exceptions_1.LMXClientUnlockException(key, uuid, shared_internal_1.LMXUnlockRequestError.BadOrMismatchedId, ` LMX Unlock request to unlock key => "${key}" timed out.`));
        }, urt);
        this.resolutions[uuid] = (err, data) => {
            client_utils_1.log.debug(chalk_1.default.cyan('unlock resolution called for key:'), key, 'uuid:', uuid, 'err:', err, 'data type:', data?.type, 'unlocked:', data?.unlocked);
            delete this.timeouts[uuid];
            clearTimeout(this.timers[uuid]);
            if (timedOut) {
                client_utils_1.log.debug(chalk_1.default.cyan('unlock resolution: already timed out for key:'), key, 'uuid:', uuid);
                return;
            }
            if (err) {
                client_utils_1.log.debug(chalk_1.default.cyan('unlock resolution: error for key:'), key, 'uuid:', uuid, 'err:', err);
                return this.fireUnlockCallbackWithError(cb, false, new exceptions_1.LMXClientUnlockException(key, uuid, shared_internal_1.LMXUnlockRequestError.InternalError, 'LMX unknown/internal error: ' + util.inspect(err, { breakLength: Infinity })));
            }
            if (!data) {
                client_utils_1.log.debug(chalk_1.default.cyan('unlock resolution: missing data for key:'), key, 'uuid:', uuid);
                return this.fireUnlockCallbackWithError(cb, false, new exceptions_1.LMXClientUnlockException(key, uuid, shared_internal_1.LMXUnlockRequestError.InternalError, `lmx internal error: missing data in unlock resolution.`));
            }
            if (String(key) !== String(data.key)) {
                client_utils_1.log.debug(chalk_1.default.cyan('unlock resolution: key mismatch for key:'), key, 'uuid:', uuid, 'data.key:', data.key);
                return this.fireUnlockCallbackWithError(cb, false, new exceptions_1.LMXClientUnlockException(key, uuid, shared_internal_1.LMXUnlockRequestError.InternalError, `lmx implementation error, bad key => first key: ${key}, second key: ${data.key}`));
            }
            if (data.error) {
                client_utils_1.log.debug(chalk_1.default.cyan('unlock resolution: data.error for key:'), key, 'uuid:', uuid, 'error:', data.error);
                return this.fireUnlockCallbackWithError(cb, false, new exceptions_1.LMXClientUnlockException(key, uuid, shared_internal_1.LMXUnlockRequestError.GeneralUnlockError, 'lmx request error: ' + data.error));
            }
            if (data.unlocked === true) {
                client_utils_1.log.debug(chalk_1.default.cyan('unlock resolution: unlocked=true, calling cb for key:'), key, 'uuid:', uuid);
                this.cleanUp(uuid);
                // this.write({
                //   uuid: uuid,
                //   key: key,
                //   type: 'unlock-received'
                // });
                return cb(null, { id: uuid, key, unlocked: true });
            }
            if (data.unlocked === false) {
                // data.error will most likely be defined as well
                // so this may never get hit
                return this.fireUnlockCallbackWithError(cb, false, new exceptions_1.LMXClientUnlockException(key, uuid, shared_internal_1.LMXUnlockRequestError.GeneralUnlockError, data));
            }
            this.fireUnlockCallbackWithError(cb, false, new exceptions_1.LMXClientUnlockException(key, uuid, shared_internal_1.LMXUnlockRequestError.GeneralUnlockError, 'lmx internal/implementation error: fallthrough in unlock resolution routine.'));
        };
        let force = (opts.__retryCount > 0) || Boolean(opts.force);
        client_utils_1.log.debug(chalk_1.default.cyan('unlock: sending unlock request for key:'), key, 'uuid:', uuid, '_uuid:', opts._uuid, 'force:', force);
        this.write({
            _uuid: opts._uuid,
            uuid: uuid,
            key: key,
            rwStatus,
            force: force,
            type: 'unlock'
        });
        client_utils_1.log.debug(chalk_1.default.cyan('unlock: unlock request sent for key:'), key, 'uuid:', uuid);
    }
    ping(cb) {
        if (cb && typeof cb !== 'function') {
            throw new Error('Optional callback must be a function.');
        }
        return new Promise((resolve, reject) => {
            if (!this.isOpen) {
                reject(new Error('Connection is not open. Call ensure() or connect() first.'));
                return;
            }
            const uuid = UUID.v4();
            const clientTimestamp = Date.now();
            this.resolutions[uuid] = (err, data) => {
                delete this.resolutions[uuid];
                if (err) {
                    return reject(new Error(`Ping error: ${util.inspect(err)}`));
                }
                if (!data || data.type !== 'pong') {
                    return reject(new Error('Invalid ping response from server'));
                }
                resolve({
                    roundTripTime: Date.now() - clientTimestamp,
                    serverTime: data.serverTimestamp,
                    timestamp: data.timestamp
                });
            };
            this.write({
                uuid: uuid,
                type: 'ping',
                timestamp: clientTimestamp
            });
        })
            .then(val => {
            cb && cb(null, val);
            return val;
        }).catch(err => {
            cb && cb(err);
            return Promise.reject(err);
        });
    }
    getSystemStats(cb) {
        if (cb && typeof cb !== 'function') {
            throw new Error('Optional callback must be a function.');
        }
        return new Promise((resolve, reject) => {
            if (!this.isOpen) {
                return reject(new Error('Connection is not open. Call ensure() or connect() first.'));
            }
            const uuid = UUID.v4();
            this.resolutions[uuid] = (err, data) => {
                delete this.resolutions[uuid];
                if (err) {
                    return reject(new Error(`System stats error: ${util.inspect(err)}`));
                }
                if (!data || data.type !== 'system-stats-response') {
                    return reject(new Error('Invalid system stats response from server'));
                }
                // Add client-side stats too
                const clientStats = {
                    clientMemoryUsage: process.memoryUsage(),
                    clientUptime: process.uptime(),
                    clientPid: process.pid
                };
                const result = {
                    broker: data.stats,
                    client: clientStats,
                    receivedAt: Date.now()
                };
                resolve(result);
            };
            this.write({
                uuid: uuid,
                type: 'system-stats-request'
            });
        }).then(val => {
            cb && cb(null, val);
            return val;
        }).catch(err => {
            cb && cb(err);
            return Promise.reject(err);
        });
    }
}
exports.Client = Client;
// aliases
exports.default = Client;
exports.LMXClient = Client;
exports.LvMtxClient = Client;
