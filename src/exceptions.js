'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.LMXClientUnlockException = exports.LMXClientLockException = exports.LMXClientException = void 0;
const util = require("util");
class LMXClientException {
    constructor(key, id, code, message, originalError) {
        this.id = id;
        this.key = key;
        this.code = code;
        this.originalError = originalError;
        if (typeof message !== 'string') {
            message = util.inspect(message, { breakLength: Infinity });
        }
        this.message = message;
        this.stack = message;
    }
}
exports.LMXClientException = LMXClientException;
class LMXClientLockException {
    constructor(key, id, code, message) {
        this.id = id;
        this.key = key;
        this.code = code;
        if (typeof message !== 'string') {
            message = util.inspect(message, { breakLength: Infinity });
        }
        this.message = message;
        this.stack = message;
    }
}
exports.LMXClientLockException = LMXClientLockException;
class LMXClientUnlockException {
    constructor(key, id, code, message) {
        this.id = id;
        this.key = key;
        this.code = code;
        if (typeof message !== 'string') {
            message = util.inspect(message, { breakLength: Infinity });
        }
        this.message = message;
        this.stack = message;
    }
}
exports.LMXClientUnlockException = LMXClientUnlockException;
