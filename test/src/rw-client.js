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
exports.RWLockReadPrefClient = exports.RWLockClient = exports.log = void 0;
const assert = __importStar(require("assert"));
const client_1 = require("./client");
const main_1 = require("./main");
const chalk_1 = __importDefault(require("chalk"));
const shared_internal_1 = require("./shared-internal");
const debugLog = process.argv.indexOf('--lmx-debug') > 0;
exports.log = {
    info: console.log.bind(console, chalk_1.default.gray.bold('[lmx client info]')),
    warn: console.error.bind(console, chalk_1.default.magenta.bold('[lmx client warning]')),
    error: console.error.bind(console, chalk_1.default.red.bold('[lmx client error]')),
    debug: function (...args) {
        if (debugLog) {
            let newTime = Date.now();
            let elapsed = newTime - shared_internal_1.forDebugging.previousTime;
            shared_internal_1.forDebugging.previousTime = newTime;
            console.log(chalk_1.default.yellow.bold('[lmx debugging]'), 'elapsed millis:', `(${elapsed})`, ...args);
        }
    }
};
const shared_internal_2 = require("./shared-internal");
const exceptions_1 = require("./exceptions");
class RWLockClient extends client_1.Client {
    constructor(o, cb) {
        super(o, cb);
        this.readerCounts = {};
        this.writeKeys = {}; // keeps track of whether a key has been registered as a write key
        // RWClient implementation - read-preferring RW lock
        // Note: This is a basic implementation and may need further refinement
    }
    beginReadp(key, opts) {
        return new Promise((resolve, reject) => {
            this.beginRead(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    endReadp(key, opts) {
        return new Promise((resolve, reject) => {
            this.endRead(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    beginWritep(key, opts) {
        return new Promise((resolve, reject) => {
            this.beginWrite(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    endWritep(key, opts) {
        return new Promise((resolve, reject) => {
            this.endWrite(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    acquireWriteLock(key, opts, cb) {
        return this.beginWrite.apply(this, arguments);
    }
    acquireReadLock(key, opts, cb) {
        return this.beginRead.apply(this, arguments);
    }
    releaseWriteLock(key, opts, cb) {
        return this.endWrite.apply(this, arguments);
    }
    releaseReadLock(key, opts, cb) {
        return this.endRead.apply(this, arguments);
    }
    acquireWriteLockp(key, opts) {
        return new Promise((resolve, reject) => {
            this.beginWrite(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    acquireReadLockp(key, opts) {
        return new Promise((resolve, reject) => {
            this.beginRead(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    releaseWriteLockp(key, opts) {
        return new Promise((resolve, reject) => {
            this.endWrite(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    releaseReadLockp(key, opts) {
        return new Promise((resolve, reject) => {
            this.endRead(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    beginWrite(key, opts, cb) {
        try {
            [key, opts, cb] = this.parseLockOpts(key, opts, cb);
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // we prioritize write locks, over read locks, by using force = true
        opts.max = 1;
        opts.force = true;
        opts.rwStatus = shared_internal_2.RWStatus.BeginWrite;
        this.lock(key, opts, (err, val) => {
            if (err) {
                return cb(err, {});
            }
            const boundEndWrite = this.endWrite.bind(this, key);
            boundEndWrite.release = boundEndWrite.endWrite = boundEndWrite.unlock = boundEndWrite;
            boundEndWrite.key = key;
            cb(null, boundEndWrite);
        });
    }
    endWrite(key, opts, cb) {
        try {
            [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // force unlock
        opts.rwStatus = shared_internal_2.RWStatus.EndWrite;
        opts.force = true;
        this.unlock(key, opts, cb);
    }
    beginRead(key, opts, cb) {
        try {
            [key, opts, cb] = this.parseLockOpts(key, opts, cb);
        }
        catch (err) {
            assert.strict(typeof cb === 'function', 'Must include a callback to the beginRead method.');
            return process.nextTick(cb, err);
        }
        opts.rwStatus = shared_internal_2.RWStatus.BeginRead;
        // For read locks, default to 10 concurrent readers (write locks default to 1)
        // Only set max if user hasn't explicitly set it
        // If user explicitly sets max (e.g., max=1 or max=5), honor that value
        if (opts.max === undefined || opts.max === null) {
            opts.max = 10; // Default: allow up to 10 concurrent readers
        }
        // User's explicit max value (including max=1) will be honored by the broker
        opts.force = false; // we want writers to have some chance to swoop in
        const writeKey = opts.writeKey;
        try {
            assert.strict(writeKey && typeof writeKey === 'string', '"writeKey" must be a string.');
            assert.strict(key !== writeKey, 'writeKey and readKey cannot be the same string.');
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        this.lock(key, opts, (err, unlock) => {
            if (err) {
                return cb(err, {});
            }
            const readers = unlock.readersCount;
            if (!Number.isInteger(readers)) {
                return this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, unlock.id, main_1.LMXLockRequestError.InternalError, 'Implementation error, missing "readersCount".'));
            }
            const boundEndRead = this.endRead.bind(this, key, { writeKey });
            boundEndRead.endRead = boundEndRead.unlock = boundEndRead.release = boundEndRead;
            boundEndRead._unlock = unlock; // Store unlock function for endRead
            boundEndRead._writeKey = writeKey; // Store writeKey for endRead
            // If we're the first reader (readers === 1), we need to lock the writeKey
            // to prevent writers from starting while we're reading
            if (readers === 1) {
                exports.log.debug(chalk_1.default.magenta('readers is exactly 1, locking writeKey to prevent writers.'));
                // Lock the writeKey with force to ensure we get it even if a writer is waiting
                this.lock(writeKey, { rwStatus: shared_internal_2.RWStatus.LockingWriteKey, force: true }, err => {
                    if (err) {
                        // If we can't lock the writeKey, unlock the read lock and return error
                        return unlock((unlockErr) => {
                            cb(err, {});
                        });
                    }
                    // Mark that we locked the writeKey
                    boundEndRead._lockedWriteKey = true;
                    // We have both locks now, unlock the read lock and return
                    unlock(err => {
                        if (err) {
                            // If unlock fails, try to unlock writeKey too
                            this.unlock(writeKey, { force: true }, () => { });
                            return cb(err, {});
                        }
                        cb(null, boundEndRead);
                    });
                });
                return;
            }
            // Not the first reader, just unlock and return
            boundEndRead._lockedWriteKey = false;
            unlock(err => {
                if (err) {
                    return cb(err, {});
                }
                cb(null, boundEndRead);
            });
        });
    }
    endRead(key, opts, cb) {
        try {
            [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        const writeKey = opts.writeKey;
        try {
            assert.strict(writeKey && typeof writeKey === 'string', '"writeKey" must be a string.');
            assert.strict(key !== writeKey, 'writeKey and readKey cannot be the same string.');
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // Check if opts is actually the bound release function from beginRead
        const boundEndRead = (opts && typeof opts === 'object' && opts._unlock) ? opts : null;
        if (boundEndRead && boundEndRead._unlock) {
            // We have the unlock function from beginRead
            opts.rwStatus = shared_internal_2.RWStatus.EndRead;
            opts.max = 1;
            // Lock to decrement reader count
            this.lock(key, opts, (err, v) => {
                if (err) {
                    return cb(err);
                }
                const readers = v.readersCount;
                if (!Number.isInteger(readers)) {
                    return cb('Implementation error, missing "readersCount".');
                }
                // Unlock the read lock (this decrements the reader count)
                v.unlock((unlockErr) => {
                    if (unlockErr) {
                        return cb(unlockErr);
                    }
                    // If we locked the writeKey (we were the first reader) and we're now the last reader,
                    // unlock the writeKey
                    if (boundEndRead._lockedWriteKey && readers === 1) {
                        const writeKeyToUnlock = boundEndRead._writeKey || writeKey;
                        this.unlock(writeKeyToUnlock, { force: true, rwStatus: shared_internal_2.RWStatus.UnlockingWriteKey }, (writeUnlockErr) => {
                            if (writeUnlockErr) {
                                return cb(writeUnlockErr);
                            }
                            cb(null);
                        });
                    }
                    else {
                        cb(null);
                    }
                });
            });
            return;
        }
        // Fallback: acquire lock first, then release
        opts.rwStatus = shared_internal_2.RWStatus.EndRead;
        opts.max = 1;
        this.lock(key, opts, (err, v) => {
            if (err) {
                return cb(err);
            }
            const readers = v.readersCount;
            if (!Number.isInteger(readers)) {
                return cb('Implementation error, missing "readersCount".');
            }
            // Unlock the read lock
            v.unlock((unlockErr) => {
                if (unlockErr) {
                    return cb(unlockErr);
                }
                // If we were the last reader, unlock the writeKey
                if (readers === 1) {
                    this.unlock(writeKey, { force: true, rwStatus: shared_internal_2.RWStatus.UnlockingWriteKey }, (writeUnlockErr) => {
                        if (writeUnlockErr) {
                            return cb(writeUnlockErr);
                        }
                        cb(null);
                    });
                }
                else {
                    cb(null);
                }
            });
        });
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
}
exports.RWLockClient = RWLockClient;
exports.RWLockReadPrefClient = RWLockClient;
