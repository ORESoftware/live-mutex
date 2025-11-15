'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.RWLockReadPrefClient = exports.RWLockClient = exports.log = void 0;
const assert = require("assert");
const client_1 = require("./client");
const main_1 = require("./main");
const chalk_1 = require("chalk");
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
        this.writeKeys = {};
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
        opts.max = 1;
        opts.force = false;
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
            boundEndRead._unlock = unlock;
            boundEndRead._writeKey = writeKey;
            if (readers === 1) {
                exports.log.debug(chalk_1.default.magenta('readers is exactly 1, locking writeKey to prevent writers.'));
                this.lock(writeKey, { rwStatus: shared_internal_2.RWStatus.LockingWriteKey, force: true }, err => {
                    if (err) {
                        return unlock((unlockErr) => {
                            cb(err, {});
                        });
                    }
                    boundEndRead._lockedWriteKey = true;
                    unlock(err => {
                        if (err) {
                            this.unlock(writeKey, { force: true }, () => { });
                            return cb(err, {});
                        }
                        cb(null, boundEndRead);
                    });
                });
                return;
            }
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
        const boundEndRead = (opts && typeof opts === 'object' && opts._unlock) ? opts : null;
        if (boundEndRead && boundEndRead._unlock) {
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
                v.unlock((unlockErr) => {
                    if (unlockErr) {
                        return cb(unlockErr);
                    }
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
            v.unlock((unlockErr) => {
                if (unlockErr) {
                    return cb(unlockErr);
                }
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
}
exports.RWLockClient = RWLockClient;
exports.RWLockReadPrefClient = RWLockClient;
