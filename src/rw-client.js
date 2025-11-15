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
exports.RWLockReadPrefClient = exports.RWLockClient = exports.log = void 0;
var assert = require("assert");
var client_1 = require("./client");
var main_1 = require("./main");
var chalk_1 = require("chalk");
var shared_internal_1 = require("./shared-internal");
var debugLog = process.argv.indexOf('--lmx-debug') > 0;
exports.log = {
    info: console.log.bind(console, chalk_1.default.gray.bold('[lmx client info]')),
    warn: console.error.bind(console, chalk_1.default.magenta.bold('[lmx client warning]')),
    error: console.error.bind(console, chalk_1.default.red.bold('[lmx client error]')),
    debug: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (debugLog) {
            var newTime = Date.now();
            var elapsed = newTime - shared_internal_1.forDebugging.previousTime;
            shared_internal_1.forDebugging.previousTime = newTime;
            console.log.apply(console, __spreadArray([chalk_1.default.yellow.bold('[lmx debugging]'), 'elapsed millis:', "(".concat(elapsed, ")")], args, false));
        }
    }
};
var shared_internal_2 = require("./shared-internal");
var exceptions_1 = require("./exceptions");
var RWLockClient = /** @class */ (function (_super) {
    __extends(RWLockClient, _super);
    function RWLockClient(o, cb) {
        var _this = _super.call(this, o, cb) || this;
        _this.readerCounts = {};
        _this.writeKeys = {}; // keeps track of whether a key has been registered as a write key
        return _this;
        // RWClient implementation - read-preferring RW lock
        // Note: This is a basic implementation and may need further refinement
    }
    RWLockClient.prototype.beginReadp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.beginRead(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockClient.prototype.endReadp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.endRead(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockClient.prototype.beginWritep = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.beginWrite(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockClient.prototype.endWritep = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.endWrite(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockClient.prototype.acquireWriteLock = function (key, opts, cb) {
        return this.beginWrite.apply(this, arguments);
    };
    RWLockClient.prototype.acquireReadLock = function (key, opts, cb) {
        return this.beginRead.apply(this, arguments);
    };
    RWLockClient.prototype.releaseWriteLock = function (key, opts, cb) {
        return this.endWrite.apply(this, arguments);
    };
    RWLockClient.prototype.releaseReadLock = function (key, opts, cb) {
        return this.endRead.apply(this, arguments);
    };
    RWLockClient.prototype.acquireWriteLockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.beginWrite(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockClient.prototype.acquireReadLockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.beginRead(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockClient.prototype.releaseWriteLockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.endWrite(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockClient.prototype.releaseReadLockp = function (key, opts) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.endRead(key, opts, function (err, val) {
                err ? reject(err) : resolve(val);
            });
        });
    };
    RWLockClient.prototype.beginWrite = function (key, opts, cb) {
        var _a;
        var _this = this;
        try {
            _a = this.parseLockOpts(key, opts, cb), key = _a[0], opts = _a[1], cb = _a[2];
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // we prioritize write locks, over read locks, by using force = true
        opts.max = 1;
        opts.force = true;
        opts.rwStatus = shared_internal_2.RWStatus.BeginWrite;
        this.lock(key, opts, function (err, val) {
            if (err) {
                return cb(err, {});
            }
            var boundEndWrite = _this.endWrite.bind(_this, key);
            boundEndWrite.release = boundEndWrite.endWrite = boundEndWrite.unlock = boundEndWrite;
            boundEndWrite.key = key;
            cb(null, boundEndWrite);
        });
    };
    RWLockClient.prototype.endWrite = function (key, opts, cb) {
        var _a;
        try {
            _a = this.parseUnlockOpts(key, opts, cb), key = _a[0], opts = _a[1], cb = _a[2];
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // force unlock
        opts.rwStatus = shared_internal_2.RWStatus.EndWrite;
        opts.force = true;
        this.unlock(key, opts, cb);
    };
    RWLockClient.prototype.beginRead = function (key, opts, cb) {
        var _a;
        var _this = this;
        try {
            _a = this.parseLockOpts(key, opts, cb), key = _a[0], opts = _a[1], cb = _a[2];
        }
        catch (err) {
            assert.strict(typeof cb === 'function', 'Must include a callback to the beginRead method.');
            return process.nextTick(cb, err);
        }
        opts.rwStatus = shared_internal_2.RWStatus.BeginRead;
        opts.max = 1;
        opts.force = false; // we want writers to have some chance to swoop in
        var writeKey = opts.writeKey;
        try {
            assert.strict(writeKey && typeof writeKey === 'string', '"writeKey" must be a string.');
            assert.strict(key !== writeKey, 'writeKey and readKey cannot be the same string.');
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        this.lock(key, opts, function (err, unlock) {
            if (err) {
                return cb(err, {});
            }
            var readers = unlock.readersCount;
            if (!Number.isInteger(readers)) {
                return _this.fireLockCallbackWithError(cb, false, new exceptions_1.LMXClientLockException(key, unlock.id, main_1.LMXLockRequestError.InternalError, 'Implementation error, missing "readersCount".'));
            }
            var boundEndRead = _this.endRead.bind(_this, key, { writeKey: writeKey });
            boundEndRead.endRead = boundEndRead.unlock = boundEndRead.release = boundEndRead;
            boundEndRead._unlock = unlock; // Store unlock function for endRead
            boundEndRead._writeKey = writeKey; // Store writeKey for endRead
            // If we're the first reader (readers === 1), we need to lock the writeKey
            // to prevent writers from starting while we're reading
            if (readers === 1) {
                exports.log.debug(chalk_1.default.magenta('readers is exactly 1, locking writeKey to prevent writers.'));
                // Lock the writeKey with force to ensure we get it even if a writer is waiting
                _this.lock(writeKey, { rwStatus: shared_internal_2.RWStatus.LockingWriteKey, force: true }, function (err) {
                    if (err) {
                        // If we can't lock the writeKey, unlock the read lock and return error
                        return unlock(function (unlockErr) {
                            cb(err, {});
                        });
                    }
                    // Mark that we locked the writeKey
                    boundEndRead._lockedWriteKey = true;
                    // We have both locks now, unlock the read lock and return
                    unlock(function (err) {
                        if (err) {
                            // If unlock fails, try to unlock writeKey too
                            _this.unlock(writeKey, { force: true }, function () { });
                            return cb(err, {});
                        }
                        cb(null, boundEndRead);
                    });
                });
                return;
            }
            // Not the first reader, just unlock and return
            boundEndRead._lockedWriteKey = false;
            unlock(function (err) {
                if (err) {
                    return cb(err, {});
                }
                cb(null, boundEndRead);
            });
        });
    };
    RWLockClient.prototype.endRead = function (key, opts, cb) {
        var _a;
        var _this = this;
        try {
            _a = this.parseUnlockOpts(key, opts, cb), key = _a[0], opts = _a[1], cb = _a[2];
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        var writeKey = opts.writeKey;
        try {
            assert.strict(writeKey && typeof writeKey === 'string', '"writeKey" must be a string.');
            assert.strict(key !== writeKey, 'writeKey and readKey cannot be the same string.');
        }
        catch (err) {
            return process.nextTick(cb, err);
        }
        // Check if opts is actually the bound release function from beginRead
        var boundEndRead = (opts && typeof opts === 'object' && opts._unlock) ? opts : null;
        if (boundEndRead && boundEndRead._unlock) {
            // We have the unlock function from beginRead
            opts.rwStatus = shared_internal_2.RWStatus.EndRead;
            opts.max = 1;
            // Lock to decrement reader count
            this.lock(key, opts, function (err, v) {
                if (err) {
                    return cb(err);
                }
                var readers = v.readersCount;
                if (!Number.isInteger(readers)) {
                    return cb('Implementation error, missing "readersCount".');
                }
                // Unlock the read lock (this decrements the reader count)
                v.unlock(function (unlockErr) {
                    if (unlockErr) {
                        return cb(unlockErr);
                    }
                    // If we locked the writeKey (we were the first reader) and we're now the last reader,
                    // unlock the writeKey
                    if (boundEndRead._lockedWriteKey && readers === 1) {
                        var writeKeyToUnlock = boundEndRead._writeKey || writeKey;
                        _this.unlock(writeKeyToUnlock, { force: true, rwStatus: shared_internal_2.RWStatus.UnlockingWriteKey }, function (writeUnlockErr) {
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
        this.lock(key, opts, function (err, v) {
            if (err) {
                return cb(err);
            }
            var readers = v.readersCount;
            if (!Number.isInteger(readers)) {
                return cb('Implementation error, missing "readersCount".');
            }
            // Unlock the read lock
            v.unlock(function (unlockErr) {
                if (unlockErr) {
                    return cb(unlockErr);
                }
                // If we were the last reader, unlock the writeKey
                if (readers === 1) {
                    _this.unlock(writeKey, { force: true, rwStatus: shared_internal_2.RWStatus.UnlockingWriteKey }, function (writeUnlockErr) {
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
    };
    return RWLockClient;
}(client_1.Client));
exports.RWLockClient = RWLockClient;
exports.RWLockReadPrefClient = RWLockClient;
