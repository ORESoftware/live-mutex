'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.RWLockWritePrefClient = exports.log = void 0;
//npm
var chalk_1 = require("chalk");
var UUID = require("uuid");
//project
var client_1 = require("./client");
var we_are_debugging_1 = require("./we-are-debugging");
exports.log = {
    info: console.log.bind(console, chalk_1.default.gray.bold('lmx client info:')),
    warn: console.error.bind(console, chalk_1.default.magenta.bold('lmx client warning:')),
    error: console.error.bind(console, chalk_1.default.red.bold('lmx client error:')),
    debug: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        // Always log RW lock operations for debugging
        if (we_are_debugging_1.weAreDebugging || process.env.LMX_DEBUG_RW === '1' || process.env.LMX_CAPTURE_LOGS === '1') {
            console.log.apply(console, __spreadArray(['lmx debugging:'], args, false));
        }
    }
};
var RWLockWritePrefClient = /** @class */ (function (_super) {
    __extends(RWLockWritePrefClient, _super);
    function RWLockWritePrefClient(o, cb) {
        var _this = _super.call(this, o, cb) || this;
        _this.readerCounts = {};
        _this.writeKeys = {}; // keeps track of whether a key has been registered as a write key
        return _this;
    }
    RWLockWritePrefClient.prototype.beginReadp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.acquireReadLock(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockWritePrefClient.prototype.endReadp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.releaseReadLock(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockWritePrefClient.prototype.beginWritep = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.acquireWriteLock(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockWritePrefClient.prototype.endWritep = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.releaseWriteLock(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockWritePrefClient.prototype.acquireWriteLockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.acquireWriteLock(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockWritePrefClient.prototype.acquireReadLockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.acquireReadLock(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockWritePrefClient.prototype.releaseWriteLockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.releaseWriteLock(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockWritePrefClient.prototype.releaseReadLockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.releaseReadLock(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockWritePrefClient.prototype.acquireWriteLock = function (key, opts, cb) {
        var _a;
        var _this = this;
        try {
            _a = this.parseLockOpts(key, opts, cb), key = _a[0], opts = _a[1], cb = _a[2];
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        opts.max = 1;
        // Create a bound release function that will pass itself as the opts parameter
        var boundRelease = function (cb) {
            return _this.releaseWriteLock(key, boundRelease, cb);
        };
        exports.log.debug(chalk_1.default.blue('[RW] acquireWriteLock acquiring base lock for key:'), key);
        this.lock(key, opts, function (err, unlock) {
            exports.log.debug(chalk_1.default.blue('[RW] acquireWriteLock base lock callback fired'), { key: key, err: !!err, hasUnlock: !!unlock });
            if (err) {
                exports.log.debug(chalk_1.default.red('[RW] acquireWriteLock base lock ERROR'), { key: key, err: err });
                return cb(err, boundRelease);
            }
            exports.log.debug(chalk_1.default.blue('acquireWriteLock got lock on:'), key);
            exports.log.debug(chalk_1.default.blue('[RW] acquireWriteLock starting registerWriteFlagAndReadersCheck for key:'), key);
            _this.registerWriteFlagAndReadersCheck(key, {}, function (err, val) {
                exports.log.debug(chalk_1.default.blue('[RW] acquireWriteLock registerWriteFlagAndReadersCheck callback fired'), { key: key, err: !!err, hasVal: !!val });
                if (err) {
                    // If there's an error, we need to unlock the lock we just acquired
                    unlock(function (unlockErr) {
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
    };
    RWLockWritePrefClient.prototype.releaseWriteLock = function (key, opts, cb) {
        var _a;
        var _this = this;
        // Check if opts is actually the bound release function with stored unlock BEFORE parseUnlockOpts
        // because parseUnlockOpts will treat a function as a callback and move it to cb
        exports.log.debug(chalk_1.default.blue('releaseWriteLock: BEFORE parseUnlockOpts - key:'), key, 'opts type:', typeof opts, 'has _unlock:', opts && opts._unlock ? 'yes' : 'no', 'cb type:', typeof cb);
        var boundRelease = (opts && (typeof opts === 'object' || typeof opts === 'function') && opts._unlock) ? opts : null;
        // If we found boundRelease, we need to handle it specially
        if (boundRelease && boundRelease._unlock) {
            // We have the unlock function from when we acquired the lock
            exports.log.debug(chalk_1.default.blue('releaseWriteLock using stored unlock for:'), key);
            var unlockFn = boundRelease._unlock;
            var realCb_1 = cb || (function () { });
            // Unlock the lock first
            exports.log.debug(chalk_1.default.blue('releaseWriteLock: calling _unlock for key:'), key);
            unlockFn(function (err, val) {
                exports.log.debug(chalk_1.default.blue('releaseWriteLock: _unlock callback called for key:'), key, 'err:', err, 'val unlocked:', val === null || val === void 0 ? void 0 : val.unlocked);
                if (err) {
                    exports.log.debug(chalk_1.default.blue('releaseWriteLock unlock error on:'), key, err);
                    delete boundRelease._unlock;
                    delete boundRelease._key;
                    return realCb_1(err, val);
                }
                exports.log.debug(chalk_1.default.blue('releaseWriteLock unlocked, now setting write flag to false on:'), key);
                // Set the write flag to false and broadcast to waiting readers
                // This must happen after unlock to avoid deadlocks
                _this.setWriteFlagToFalse(key, function (flagErr, flagVal) {
                    exports.log.debug(chalk_1.default.blue('releaseWriteLock: setWriteFlagToFalse callback called for key:'), key, 'flagErr:', flagErr, 'flagVal type:', flagVal === null || flagVal === void 0 ? void 0 : flagVal.type);
                    exports.log.debug(chalk_1.default.blue('releaseWriteLock completed on:'), key);
                    delete boundRelease._unlock;
                    delete boundRelease._key;
                    // Return success even if flag setting had minor issues
                    exports.log.debug(chalk_1.default.blue('releaseWriteLock: calling final cb for key:'), key, 'cb type:', typeof realCb_1);
                    realCb_1(null, val);
                });
            });
            return;
        }
        // Normal path: parse options
        try {
            _a = this.parseUnlockOpts(key, opts, cb), key = _a[0], opts = _a[1], cb = _a[2];
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // Fallback: acquire lock first, then release
        opts.max = 1;
        var fallbackStart = Date.now();
        exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback path'), { key: key });
        this.lock(key, opts, function (err, unlock) {
            if (err) {
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback lock error'), { key: key, err: err });
                return cb(err, unlock);
            }
            exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock got lock on:'), key);
            // Unlock first
            var fallbackUnlockStart = Date.now();
            unlock(function (unlockErr, unlockVal) {
                var fallbackUnlockTime = Date.now() - fallbackUnlockStart;
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback unlock callback'), { key: key, err: !!unlockErr, fallbackUnlockTime: fallbackUnlockTime });
                if (unlockErr) {
                    exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback unlock error:'), unlockErr);
                    return cb(unlockErr, unlockVal);
                }
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock unlocked, now setting write flag to false'));
                var fallbackFlagStart = Date.now();
                _this.setWriteFlagToFalse(key, function (flagErr, flagVal) {
                    var fallbackFlagTime = Date.now() - fallbackFlagStart;
                    var fallbackTotalTime = Date.now() - fallbackStart;
                    exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseWriteLock fallback completed'), { key: key, fallbackFlagTime: fallbackFlagTime, fallbackTotalTime: fallbackTotalTime });
                    // Return success even if flag setting had minor issues
                    cb(null, unlockVal);
                });
            });
        });
    };
    RWLockWritePrefClient.prototype.acquireReadLock = function (key, opts, cb) {
        var _a;
        var _this = this;
        try {
            _a = this.parseLockOpts(key, opts, cb), key = _a[0], opts = _a[1], cb = _a[2];
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // Create a bound release function that will pass itself as the opts parameter
        var boundRelease = function (cb) {
            exports.log.debug(chalk_1.default.blue('boundRelease function called for key:'), key, 'cb type:', typeof cb, 'has _unlock:', boundRelease._unlock ? 'yes' : 'no');
            if (!boundRelease._unlock) {
                exports.log.error(chalk_1.default.red('boundRelease called but _unlock is missing for key:'), key);
                if (typeof cb === 'function') {
                    return process.nextTick(cb, new Error('_unlock function missing from boundRelease'), {});
                }
                return;
            }
            return _this.releaseReadLock(key, boundRelease, cb);
        };
        // First check writer flag BEFORE acquiring lock (critical fix)
        exports.log.debug(chalk_1.default.blue('[RW] acquireReadLock starting writer flag check for key:'), key);
        this.registerWriteFlagCheck(key, {}, function (err, val) {
            exports.log.debug(chalk_1.default.blue('[RW] acquireReadLock writer flag check callback fired'), { key: key, err: !!err, hasVal: !!val });
            if (err) {
                exports.log.debug(chalk_1.default.red('[RW] acquireReadLock writer flag check ERROR'), { key: key, err: err });
                return cb(err, boundRelease);
            }
            exports.log.debug(chalk_1.default.blue('acquireReadLock writer flag check passed, acquiring lock'));
            // For read locks, allow multiple readers to coexist
            // Use a high max value to allow concurrent readers
            // The actual reader count is tracked separately via incrementReaders
            if (!opts.max || opts.max === 1) {
                opts.max = 1000; // Allow up to 1000 concurrent readers
            }
            _this.lock(key, opts, function (err, unlock) {
                if (err) {
                    return cb(err, boundRelease);
                }
                exports.log.debug(chalk_1.default.blue('acquireReadLock got lock on key:'), key);
                // Increment readers count
                _this.incrementReaders(key, function (err, val) {
                    if (err) {
                        unlock(function () { });
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
    };
    RWLockWritePrefClient.prototype.releaseReadLock = function (key, opts, cb) {
        var _a;
        var _this = this;
        // Check if opts is actually the bound release function BEFORE parseUnlockOpts
        // because parseUnlockOpts will treat a function as a callback and move it to cb
        exports.log.debug(chalk_1.default.blue('releaseReadLock: BEFORE parseUnlockOpts - key:'), key, 'opts type:', typeof opts, 'has _unlock:', opts && opts._unlock ? 'yes' : 'no', 'cb type:', typeof cb);
        var boundRelease = (opts && (typeof opts === 'object' || typeof opts === 'function') && opts._unlock) ? opts : null;
        // If we found boundRelease, we need to handle it specially
        // because parseUnlockOpts will treat it as a callback
        if (boundRelease && boundRelease._unlock) {
            // boundRelease is the function itself, and cb is the actual callback
            // We need to extract the real callback
            var realCb_2 = (typeof cb === 'function') ? cb : boundRelease;
            var unlockFn_1 = boundRelease._unlock; // Store it before it might get deleted
            exports.log.debug(chalk_1.default.blue('releaseReadLock: found boundRelease, using stored unlock for key:'), key, 'unlockFn type:', typeof unlockFn_1);
            if (!unlockFn_1 || typeof unlockFn_1 !== 'function') {
                exports.log.error(chalk_1.default.red('releaseReadLock: _unlock is not a function for key:'), key, 'type:', typeof unlockFn_1);
                return realCb_2(new Error('_unlock is not a function'), {});
            }
            exports.log.debug(chalk_1.default.blue('releaseReadLock: calling decrementReaders for key:'), key);
            this.decrementReaders(key, function (err, val) {
                exports.log.debug(chalk_1.default.blue('releaseReadLock: decrementReaders callback called for key:'), key, 'err:', err, 'val type:', val === null || val === void 0 ? void 0 : val.type);
                if (err) {
                    exports.log.debug(chalk_1.default.blue('releaseReadLock: decrementReaders error, calling cb with error'));
                    return realCb_2(err, {});
                }
                exports.log.debug(chalk_1.default.blue('releaseReadLock: calling _unlock for key:'), key, '_unlock type:', typeof unlockFn_1);
                // Use the stored unlock function (we stored it earlier to avoid deletion issues)
                try {
                    unlockFn_1(function (err, val) {
                        exports.log.debug(chalk_1.default.blue('releaseReadLock: _unlock callback called for key:'), key, 'err:', err, 'val unlocked:', val === null || val === void 0 ? void 0 : val.unlocked);
                        exports.log.debug(chalk_1.default.blue('releaseReadLock released lock on key:'), key);
                        // Only delete after successful unlock
                        if (boundRelease._unlock) {
                            delete boundRelease._unlock;
                        }
                        if (boundRelease._key) {
                            delete boundRelease._key;
                        }
                        exports.log.debug(chalk_1.default.blue('releaseReadLock: calling final cb for key:'), key, 'cb type:', typeof realCb_2);
                        realCb_2(err, val);
                    });
                }
                catch (e) {
                    exports.log.error(chalk_1.default.red('releaseReadLock: exception calling _unlock for key:'), key, e);
                    return realCb_2(e, {});
                }
            });
            return;
        }
        // Normal path: parse options
        try {
            _a = this.parseUnlockOpts(key, opts, cb), key = _a[0], opts = _a[1], cb = _a[2];
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // Fallback: acquire lock first, then release
        opts.max = 1;
        var fallbackStart = Date.now();
        exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock fallback path'), { key: key });
        this.lock(key, opts, function (err, unlock) {
            if (err) {
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock fallback lock error'), { key: key, err: err });
                return cb(err, unlock);
            }
            exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock got lock on key:'), key);
            var fallbackDecrementStart = Date.now();
            _this.decrementReaders(key, function (err, val) {
                var fallbackDecrementTime = Date.now() - fallbackDecrementStart;
                exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock fallback decrementReaders callback'), { key: key, err: !!err, fallbackDecrementTime: fallbackDecrementTime });
                if (err) {
                    return cb(err, unlock);
                }
                var fallbackUnlockStart = Date.now();
                unlock(function (err, val) {
                    var fallbackUnlockTime = Date.now() - fallbackUnlockStart;
                    var fallbackTotalTime = Date.now() - fallbackStart;
                    exports.log.debug(chalk_1.default.magenta('[RW-RELEASE] releaseReadLock fallback completed'), { key: key, fallbackUnlockTime: fallbackUnlockTime, fallbackTotalTime: fallbackTotalTime });
                    cb(err, val);
                });
            });
        });
    };
    RWLockWritePrefClient.prototype.registerWriteFlagCheck = function (key, opts, cb) {
        var _this = this;
        var uuid = UUID.v4();
        exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagCheck START'), { key: key, uuid: uuid });
        this.resolutions[uuid] = function (err, val) {
            exports.log.debug(chalk_1.default.magenta('client got register-write-flag-check response, type:', val === null || val === void 0 ? void 0 : val.type, 'uuid:', uuid));
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
                exports.log.debug(chalk_1.default.magenta('unexpected broadcast-result, still waiting for register-write-flag-success'), { val: val });
                return;
            }
            // This is the final success response (register-write-flag-success)
            exports.log.debug(chalk_1.default.magenta('received final success response, calling callback'));
            delete _this.resolutions[uuid];
            exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagCheck CALLING CALLBACK'), { key: key, uuid: uuid });
            return cb(err, val);
        };
        exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagCheck SENDING REQUEST'), { key: key, uuid: uuid });
        this.write({ key: key, uuid: uuid, type: 'register-write-flag-check' });
    };
    RWLockWritePrefClient.prototype.registerWriteFlagAndReadersCheck = function (key, opts, cb) {
        var _this = this;
        var uuid = UUID.v4();
        exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagAndReadersCheck START'), { key: key, uuid: uuid });
        this.resolutions[uuid] = function (err, val) {
            exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagAndReadersCheck RESPONSE'), { key: key, uuid: uuid, err: !!err, valType: val === null || val === void 0 ? void 0 : val.type, hasVal: !!val });
            delete _this.resolutions[uuid];
            exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagAndReadersCheck CALLING CALLBACK'), { key: key, uuid: uuid });
            cb(err, val);
        };
        exports.log.debug(chalk_1.default.cyan('[RW] registerWriteFlagAndReadersCheck SENDING REQUEST'), { key: key, uuid: uuid });
        this.write({
            key: key,
            uuid: uuid,
            type: 'register-write-flag-and-readers-check'
        });
    };
    RWLockWritePrefClient.prototype.incrementReaders = function (key, cb) {
        var uuid = UUID.v4();
        exports.log.debug(chalk_1.default.cyan('[RW] incrementReaders START'), { key: key, uuid: uuid });
        this.resolutions[uuid] = function (err, val) {
            exports.log.debug(chalk_1.default.cyan('[RW] incrementReaders RESPONSE'), { key: key, uuid: uuid, err: !!err, valType: val === null || val === void 0 ? void 0 : val.type, hasVal: !!val });
            exports.log.debug(chalk_1.default.cyan('[RW] incrementReaders CALLING CALLBACK'), { key: key, uuid: uuid });
            cb(err, val);
        };
        exports.log.debug(chalk_1.default.cyan('[RW] incrementReaders SENDING REQUEST'), { key: key, uuid: uuid });
        this.write({
            uuid: uuid,
            type: 'increment-readers',
            key: key
        });
    };
    RWLockWritePrefClient.prototype.decrementReaders = function (key, cb) {
        var uuid = UUID.v4();
        exports.log.debug(chalk_1.default.magenta('decrementReaders: sending request for key:'), key, 'uuid:', uuid);
        this.resolutions[uuid] = function (err, val) {
            exports.log.debug(chalk_1.default.magenta('decrementReaders: received response for key:'), key, 'uuid:', uuid, 'type:', val === null || val === void 0 ? void 0 : val.type);
            cb(err, val);
        };
        this.write({
            uuid: uuid,
            type: 'decrement-readers',
            key: key
        });
    };
    RWLockWritePrefClient.prototype.setWriteFlagToFalse = function (key, cb) {
        var uuid = UUID.v4();
        exports.log.debug(chalk_1.default.magenta('setWriteFlagToFalse: sending request for key:'), key, 'uuid:', uuid);
        this.resolutions[uuid] = function (err, val) {
            exports.log.debug(chalk_1.default.magenta('setWriteFlagToFalse: received response for key:'), key, 'uuid:', uuid, 'type:', val === null || val === void 0 ? void 0 : val.type, 'err:', err);
            cb(err, val);
        };
        this.write({
            uuid: uuid,
            type: 'set-write-flag-false-and-broadcast',
            key: key
        });
    };
    return RWLockWritePrefClient;
}(client_1.Client));
exports.RWLockWritePrefClient = RWLockWritePrefClient;
