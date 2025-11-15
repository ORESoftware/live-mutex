'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RWLockWritePrefClient = exports.log = void 0;
//npm
const chalk_1 = __importDefault(require("chalk"));
const UUID = require("uuid");
//project
const client_1 = require("./client");
const we_are_debugging_1 = require("./we-are-debugging");
exports.log = {
    info: console.log.bind(console, chalk_1.default.gray.bold('lmx client info:')),
    warn: console.error.bind(console, chalk_1.default.magenta.bold('lmx client warning:')),
    error: console.error.bind(console, chalk_1.default.red.bold('lmx client error:')),
    debug: function (...args) {
        // Always log RW lock operations for debugging
        if (we_are_debugging_1.weAreDebugging || process.env.LMX_DEBUG_RW === '1' || process.env.LMX_CAPTURE_LOGS === '1') {
            console.log('lmx debugging:', ...args);
        }
    }
};
class RWLockWritePrefClient extends client_1.Client {
    constructor(o, cb) {
        super(o, cb);
        this.readerCounts = {};
        this.writeKeys = {}; // keeps track of whether a key has been registered as a write key
    }
    beginReadp(key, opts) {
        return new Promise((resolve, reject) => {
            this.acquireReadLock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    endReadp(key, opts) {
        return new Promise((resolve, reject) => {
            this.releaseReadLock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    beginWritep(key, opts) {
        return new Promise((resolve, reject) => {
            this.acquireWriteLock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    endWritep(key, opts) {
        return new Promise((resolve, reject) => {
            this.releaseWriteLock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    acquireWriteLockp(key, opts) {
        return new Promise((resolve, reject) => {
            this.acquireWriteLock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    acquireReadLockp(key, opts) {
        return new Promise((resolve, reject) => {
            this.acquireReadLock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    releaseWriteLockp(key, opts) {
        return new Promise((resolve, reject) => {
            this.releaseWriteLock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    releaseReadLockp(key, opts) {
        return new Promise((resolve, reject) => {
            this.releaseReadLock(key, opts, (err, val) => {
                err ? reject(err) : resolve(val);
            });
        });
    }
    acquireWriteLock(key, opts, cb) {
        try {
            [key, opts, cb] = this.parseLockOpts(key, opts, cb);
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        opts.max = 1;
        // Create a bound release function that will pass itself as the opts parameter
        const boundRelease = (cb) => {
            return this.releaseWriteLock(key, boundRelease, cb);
        };
        exports.log.debug(chalk_1.default.blue('[RW] acquireWriteLock acquiring base lock for key:'), key);
        this.lock(key, opts, (err, unlock) => {
            exports.log.debug(chalk_1.default.blue('[RW] acquireWriteLock base lock callback fired'), { key, err: !!err, hasUnlock: !!unlock });
            if (err) {
                exports.log.debug(chalk_1.default.red('[RW] acquireWriteLock base lock ERROR'), { key, err });
                return cb(err, boundRelease);
            }
            exports.log.debug(chalk_1.default.blue('acquireWriteLock got lock on:'), key);
            exports.log.debug(chalk_1.default.blue('[RW] acquireWriteLock starting registerWriteFlagAndReadersCheck for key:'), key);
            this.registerWriteFlagAndReadersCheck(key, {}, (err, val) => {
                exports.log.debug(chalk_1.default.blue('[RW] acquireWriteLock registerWriteFlagAndReadersCheck callback fired'), { key, err: !!err, hasVal: !!val });
                if (err) {
                    // If there's an error, we need to unlock the lock we just acquired
                    unlock((unlockErr) => {
                        exports.log.debug(chalk_1.default.blue('acquireWriteLock released lock due to error on:'), key);
                        return cb(err, boundRelease);
                    });
                    return;
                }
                // Store the unlock function in the bound release function
                boundRelease._unlock = unlock;
                boundRelease._key = key;
                exports.log.debug(chalk_1.default.blue('acquireWriteLock successfully acquired write lock on:'), key);
                cb(err, boundRelease);
            });
        });
    }
    releaseWriteLock(key, opts, cb) {
        // Check if opts is actually the bound release function with stored unlock BEFORE parseUnlockOpts
        // because parseUnlockOpts will treat a function as a callback and move it to cb
        exports.log.debug(chalk_1.default.blue('releaseWriteLock: BEFORE parseUnlockOpts - key:'), key, 'opts type:', typeof opts, 'has _unlock:', opts && opts._unlock ? 'yes' : 'no', 'cb type:', typeof cb);
        const boundRelease = (opts && (typeof opts === 'object' || typeof opts === 'function') && opts._unlock) ? opts : null;
        // If we found boundRelease, we need to handle it specially
        if (boundRelease && boundRelease._unlock) {
            // We have the unlock function from when we acquired the lock
            exports.log.debug(chalk_1.default.blue('releaseWriteLock using stored unlock for:'), key);
            const unlockFn = boundRelease._unlock;
            const realCb = cb || (() => { });
            // Unlock the lock first
            exports.log.debug(chalk_1.default.blue('releaseWriteLock: calling _unlock for key:'), key);
            unlockFn((err, val) => {
                exports.log.debug(chalk_1.default.blue('releaseWriteLock: _unlock callback called for key:'), key, 'err:', err, 'val unlocked:', val?.unlocked);
                if (err) {
                    exports.log.debug(chalk_1.default.blue('releaseWriteLock unlock error on:'), key, err);
                    delete boundRelease._unlock;
                    delete boundRelease._key;
                    return realCb(err, val);
                }
                exports.log.debug(chalk_1.default.blue('releaseWriteLock unlocked, now setting write flag to false on:'), key);
                // Set the write flag to false and broadcast to waiting readers
                // This must happen after unlock to avoid deadlocks
                this.setWriteFlagToFalse(key, (flagErr, flagVal) => {
                    exports.log.debug(chalk_1.default.blue('releaseWriteLock: setWriteFlagToFalse callback called for key:'), key, 'flagErr:', flagErr, 'flagVal type:', flagVal?.type);
                    exports.log.debug(chalk_1.default.blue('releaseWriteLock completed on:'), key);
                    delete boundRelease._unlock;
                    delete boundRelease._key;
                    // Return success even if flag setting had minor issues
                    exports.log.debug(chalk_1.default.blue('releaseWriteLock: calling final cb for key:'), key, 'cb type:', typeof realCb);
                    realCb(null, val);
                });
            });
            return;
        }
        // Normal path: parse options
        try {
            [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // Fallback: acquire lock first, then release
        opts.max = 1;
        const fallbackStart = Date.now();
        exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback path'), { key });
        this.lock(key, opts, (err, unlock) => {
            if (err) {
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback lock error'), { key, err });
                return cb(err, unlock);
            }
            exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock got lock on:'), key);
            // Unlock first
            const fallbackUnlockStart = Date.now();
            unlock((unlockErr, unlockVal) => {
                const fallbackUnlockTime = Date.now() - fallbackUnlockStart;
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback unlock callback'), { key, err: !!unlockErr, fallbackUnlockTime });
                if (unlockErr) {
                    exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback unlock error:'), unlockErr);
                    return cb(unlockErr, unlockVal);
                }
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock unlocked, now setting write flag to false'));
                const fallbackFlagStart = Date.now();
                this.setWriteFlagToFalse(key, (flagErr, flagVal) => {
                    const fallbackFlagTime = Date.now() - fallbackFlagStart;
                    const fallbackTotalTime = Date.now() - fallbackStart;
                    exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback completed'), { key, fallbackFlagTime, fallbackTotalTime });
                    // Return success even if flag setting had minor issues
                    cb(null, unlockVal);
                });
            });
        });
    }
    acquireReadLock(key, opts, cb) {
        try {
            [key, opts, cb] = this.parseLockOpts(key, opts, cb);
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // Create a bound release function that will pass itself as the opts parameter
        const boundRelease = (cb) => {
            exports.log.debug(chalk_1.default.blue('boundRelease function called for key:'), key, 'cb type:', typeof cb, 'has _unlock:', boundRelease._unlock ? 'yes' : 'no');
            if (!boundRelease._unlock) {
                exports.log.error(chalk_1.default.red('boundRelease called but _unlock is missing for key:'), key);
                if (typeof cb === 'function') {
                    return process.nextTick(cb, new Error('_unlock function missing from boundRelease'), {});
                }
                return;
            }
            return this.releaseReadLock(key, boundRelease, cb);
        };
        // First check writer flag BEFORE acquiring lock (critical fix)
        exports.log.debug(chalk_1.default.blue('[RW] acquireReadLock starting writer flag check for key:'), key);
        this.registerWriteFlagCheck(key, {}, (err, val) => {
            exports.log.debug(chalk_1.default.blue('[RW] acquireReadLock writer flag check callback fired'), { key, err: !!err, hasVal: !!val });
            if (err) {
                exports.log.debug(chalk_1.default.red('[RW] acquireReadLock writer flag check ERROR'), { key, err });
                return cb(err, boundRelease);
            }
            exports.log.debug(chalk_1.default.blue('acquireReadLock writer flag check passed, acquiring lock'));
            // For read locks, default to 10 concurrent readers (write locks default to 1)
            // Only set max if user hasn't explicitly set it
            // If user explicitly sets max (e.g., max=1 or max=5), honor that value
            // The actual reader count is tracked separately via incrementReaders
            if (opts.max === undefined || opts.max === null) {
                opts.max = 10; // Default: allow up to 10 concurrent readers
            }
            // User's explicit max value (including max=1) will be honored by the broker
            this.lock(key, opts, (err, unlock) => {
                if (err) {
                    return cb(err, boundRelease);
                }
                exports.log.debug(chalk_1.default.blue('acquireReadLock got lock on key:'), key);
                // Increment readers count
                this.incrementReaders(key, (err, val) => {
                    if (err) {
                        unlock(() => { });
                        return cb(err, boundRelease);
                    }
                    // Store the unlock function in the bound release function
                    boundRelease._unlock = unlock;
                    boundRelease._key = key;
                    exports.log.debug(chalk_1.default.blue('acquireReadLock successfully acquired read lock on key:'), key);
                    cb(err, boundRelease);
                });
            });
        });
    }
    releaseReadLock(key, opts, cb) {
        // Check if opts is actually the bound release function BEFORE parseUnlockOpts
        // because parseUnlockOpts will treat a function as a callback and move it to cb
        exports.log.debug(chalk_1.default.blue('releaseReadLock: BEFORE parseUnlockOpts - key:'), key, 'opts type:', typeof opts, 'has _unlock:', opts && opts._unlock ? 'yes' : 'no', 'cb type:', typeof cb);
        const boundRelease = (opts && (typeof opts === 'object' || typeof opts === 'function') && opts._unlock) ? opts : null;
        // If we found boundRelease, we need to handle it specially
        // because parseUnlockOpts will treat it as a callback
        if (boundRelease && boundRelease._unlock) {
            // boundRelease is the function itself, and cb is the actual callback
            // We need to extract the real callback
            const realCb = (typeof cb === 'function') ? cb : boundRelease;
            const unlockFn = boundRelease._unlock; // Store it before it might get deleted
            exports.log.debug(chalk_1.default.blue('releaseReadLock: found boundRelease, using stored unlock for key:'), key, 'unlockFn type:', typeof unlockFn);
            if (!unlockFn || typeof unlockFn !== 'function') {
                exports.log.error(chalk_1.default.red('releaseReadLock: _unlock is not a function for key:'), key, 'type:', typeof unlockFn);
                return realCb(new Error('_unlock is not a function'), {});
            }
            exports.log.debug(chalk_1.default.blue('releaseReadLock: calling decrementReaders for key:'), key);
            this.decrementReaders(key, (err, val) => {
                exports.log.debug(chalk_1.default.blue('releaseReadLock: decrementReaders callback called for key:'), key, 'err:', err, 'val type:', val?.type);
                if (err) {
                    exports.log.debug(chalk_1.default.blue('releaseReadLock: decrementReaders error, calling cb with error'));
                    return realCb(err, {});
                }
                exports.log.debug(chalk_1.default.blue('releaseReadLock: calling _unlock for key:'), key, '_unlock type:', typeof unlockFn);
                // Use the stored unlock function (we stored it earlier to avoid deletion issues)
                try {
                    unlockFn((err, val) => {
                        exports.log.debug(chalk_1.default.blue('releaseReadLock: _unlock callback called for key:'), key, 'err:', err, 'val unlocked:', val?.unlocked);
                        exports.log.debug(chalk_1.default.blue('releaseReadLock released lock on key:'), key);
                        // Only delete after successful unlock
                        if (boundRelease._unlock) {
                            delete boundRelease._unlock;
                        }
                        if (boundRelease._key) {
                            delete boundRelease._key;
                        }
                        exports.log.debug(chalk_1.default.blue('releaseReadLock: calling final cb for key:'), key, 'cb type:', typeof realCb);
                        realCb(err, val);
                    });
                }
                catch (e) {
                    exports.log.error(chalk_1.default.red('releaseReadLock: exception calling _unlock for key:'), key, e);
                    return realCb(e, {});
                }
            });
            return;
        }
        // Normal path: parse options
        try {
            [key, opts, cb] = this.parseUnlockOpts(key, opts, cb);
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // Fallback: acquire lock first, then release
        opts.max = 1;
        const fallbackStart = Date.now();
        exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock fallback path'), { key });
        this.lock(key, opts, (err, unlock) => {
            if (err) {
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock fallback lock error'), { key, err });
                return cb(err, unlock);
            }
            exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock got lock on key:'), key);
            const fallbackDecrementStart = Date.now();
            this.decrementReaders(key, (err, val) => {
                const fallbackDecrementTime = Date.now() - fallbackDecrementStart;
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock fallback decrementReaders callback'), { key, err: !!err, fallbackDecrementTime });
                if (err) {
                    return cb(err, unlock);
                }
                const fallbackUnlockStart = Date.now();
                unlock((err, val) => {
                    const fallbackUnlockTime = Date.now() - fallbackUnlockStart;
                    const fallbackTotalTime = Date.now() - fallbackStart;
                    exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock fallback completed'), { key, fallbackUnlockTime, fallbackTotalTime });
                    cb(err, val);
                });
            });
        });
    }
    registerWriteFlagCheck(key, opts, cb) {
        const uuid = UUID.v4();
        exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagCheck START'), { key, uuid });
        this.resolutions[uuid] = (err, val) => {
            exports.log.debug(chalk_1.default.magenta('client got register-write-flag-check response, type:', val?.type, 'uuid:', uuid));
            // If we got a queued response, wait for the actual success response
            if (val && val.type === 'register-write-flag-check-queued') {
                exports.log.debug(chalk_1.default.magenta('read request queued, waiting for writer to finish...'));
                // Don't delete the resolution yet - we need to wait for the success response
                // The broker will call the fn() which sends the success response
                return;
            }
            // Ignore broadcast-result messages - they're just notifications
            if (val && val.type === 'broadcast-result') {
                exports.log.debug(chalk_1.default.magenta('ignoring broadcast-result, still waiting for register-write-flag-success'));
                return;
            }
            if (val && val.type !== 'register-write-flag-success') {
                exports.log.debug(chalk_1.default.magenta('unexpected broadcast-result, still waiting for register-write-flag-success'), { val });
                return;
            }
            // This is the final success response (register-write-flag-success)
            exports.log.debug(chalk_1.default.magenta('received final success response, calling callback'));
            delete this.resolutions[uuid];
            exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagCheck CALLING CALLBACK'), { key, uuid });
            return cb(err, val);
        };
        exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagCheck SENDING REQUEST'), { key, uuid });
        this.write({ key, uuid, type: 'register-write-flag-check' });
    }
    registerWriteFlagAndReadersCheck(key, opts, cb) {
        const uuid = UUID.v4();
        exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagAndReadersCheck START'), { key, uuid });
        this.resolutions[uuid] = (err, val) => {
            exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagAndReadersCheck RESPONSE'), { key, uuid, err: !!err, valType: val?.type, hasVal: !!val });
            delete this.resolutions[uuid];
            exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagAndReadersCheck CALLING CALLBACK'), { key, uuid });
            cb(err, val);
        };
        exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagAndReadersCheck SENDING REQUEST'), { key, uuid });
        this.write({
            key,
            uuid,
            type: 'register-write-flag-and-readers-check'
        });
    }
    incrementReaders(key, cb) {
        const uuid = UUID.v4();
        exports.log.debug(chalk_1.default.cyan('[RW] incrementReaders START'), { key, uuid });
        this.resolutions[uuid] = (err, val) => {
            exports.log.debug(chalk_1.default.cyan('[RW] incrementReaders RESPONSE'), { key, uuid, err: !!err, valType: val?.type, hasVal: !!val });
            exports.log.debug(chalk_1.default.cyan('[RW] incrementReaders CALLING CALLBACK'), { key, uuid });
            cb(err, val);
        };
        exports.log.debug(chalk_1.default.cyan('[RW] incrementReaders SENDING REQUEST'), { key, uuid });
        this.write({
            uuid,
            type: 'increment-readers',
            key
        });
    }
    decrementReaders(key, cb) {
        const uuid = UUID.v4();
        exports.log.debug(chalk_1.default.magenta('decrementReaders: sending request for key:'), key, 'uuid:', uuid);
        this.resolutions[uuid] = (err, val) => {
            exports.log.debug(chalk_1.default.magenta('decrementReaders: received response for key:'), key, 'uuid:', uuid, 'type:', val?.type);
            cb(err, val);
        };
        this.write({
            uuid,
            type: 'decrement-readers',
            key
        });
    }
    setWriteFlagToFalse(key, cb) {
        const uuid = UUID.v4();
        exports.log.debug(chalk_1.default.magenta('setWriteFlagToFalse: sending request for key:'), key, 'uuid:', uuid);
        this.resolutions[uuid] = (err, val) => {
            exports.log.debug(chalk_1.default.magenta('setWriteFlagToFalse: received response for key:'), key, 'uuid:', uuid, 'type:', val?.type, 'err:', err);
            cb(err, val);
        };
        this.write({
            uuid,
            type: 'set-write-flag-false-and-broadcast',
            key
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
exports.RWLockWritePrefClient = RWLockWritePrefClient;
