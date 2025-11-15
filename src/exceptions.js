'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.LMXClientUnlockException = exports.LMXClientLockException = exports.LMXClientException = void 0;
var util = require("util");
var LMXClientException = /** @class */ (function () {
    function LMXClientException(key, id, code, message, originalError) {
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
    return LMXClientException;
}());
exports.LMXClientException = LMXClientException;
var LMXClientLockException = /** @class */ (function () {
    function LMXClientLockException(key, id, code, message) {
        this.id = id;
        this.key = key;
        this.code = code;
        if (typeof message !== 'string') {
            message = util.inspect(message, { breakLength: Infinity });
        }
        this.message = message;
        this.stack = message;
    }
    return LMXClientLockException;
}());
exports.LMXClientLockException = LMXClientLockException;
var LMXClientUnlockException = /** @class */ (function () {
    function LMXClientUnlockException(key, id, code, message) {
        this.id = id;
        this.key = key;
        this.code = code;
        if (typeof message !== 'string') {
            message = util.inspect(message, { breakLength: Infinity });
        }
        this.message = message;
        this.stack = message;
    }
    return LMXClientUnlockException;
}());
exports.LMXClientUnlockException = LMXClientUnlockException;
