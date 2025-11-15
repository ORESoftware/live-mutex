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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LMXClientUnlockException = exports.LMXClientLockException = exports.LMXClientException = void 0;
const util = __importStar(require("util"));
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
class LMXClientLockException extends Error {
    constructor(key, id, code, message) {
        super(message);
        this.name = 'LMXClientLockException';
        this.id = id;
        this.key = key;
        this.code = code;
        if (typeof message !== 'string') {
            message = util.inspect(message, { breakLength: Infinity });
        }
        this.message = message;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, LMXClientLockException);
        }
    }
}
exports.LMXClientLockException = LMXClientLockException;
class LMXClientUnlockException extends Error {
    constructor(key, id, code, message) {
        super(message);
        this.name = 'LMXClientUnlockException';
        this.id = id;
        this.key = key;
        this.code = code;
        if (typeof message !== 'string') {
            message = util.inspect(message, { breakLength: Infinity });
        }
        this.message = message;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, LMXClientUnlockException);
        }
    }
}
exports.LMXClientUnlockException = LMXClientUnlockException;
