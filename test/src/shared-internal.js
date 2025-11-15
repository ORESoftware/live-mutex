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
exports.RWStatus = exports.LMXUnlockRequestError = exports.LMXLockRequestError = exports.LMXClientError = exports.joinToStr = exports.inspectError = exports.forDebugging = void 0;
const util = __importStar(require("util"));
exports.forDebugging = {
    previousTime: Date.now()
};
const inspectError = (err) => {
    return typeof err === 'string' ? err : util.inspect(err, {
        showHidden: true,
        depth: 5
    });
};
exports.inspectError = inspectError;
const joinToStr = (...args) => {
    return args.map(exports.inspectError).join(' ');
};
exports.joinToStr = joinToStr;
var LMXClientError;
(function (LMXClientError) {
    LMXClientError["VersionMismatch"] = "version_mismatch";
    LMXClientError["UnknownError"] = "unknown_error";
})(LMXClientError || (exports.LMXClientError = LMXClientError = {}));
var LMXLockRequestError;
(function (LMXLockRequestError) {
    LMXLockRequestError["ConnectionRecovering"] = "connection_is_recovering";
    LMXLockRequestError["GenericLockError"] = "generic_lock_error";
    LMXLockRequestError["MaxRetries"] = "max_retries";
    LMXLockRequestError["RequestTimeoutError"] = "request_timeout";
    LMXLockRequestError["BadArgumentsError"] = "bad_args";
    LMXLockRequestError["InternalError"] = "internal_error";
    LMXLockRequestError["UnknownException"] = "unknown_exception";
    LMXLockRequestError["WaitOptionSetToFalse"] = "wait_option_is_false";
    LMXLockRequestError["CannotContinue"] = "cannot_continue";
    LMXLockRequestError["ConnectionClosed"] = "connection_closed";
})(LMXLockRequestError || (exports.LMXLockRequestError = LMXLockRequestError = {}));
var LMXUnlockRequestError;
(function (LMXUnlockRequestError) {
    LMXUnlockRequestError["BadOrMismatchedId"] = "bad_or_mismatched_id";
    LMXUnlockRequestError["UnknownException"] = "unknown_exception";
    LMXUnlockRequestError["InternalError"] = "internal_error";
    LMXUnlockRequestError["GeneralUnlockError"] = "general_unlock_error";
})(LMXUnlockRequestError || (exports.LMXUnlockRequestError = LMXUnlockRequestError = {}));
var RWStatus;
(function (RWStatus) {
    RWStatus["EndWrite"] = "end_write";
    RWStatus["BeginWrite"] = "begin_write";
    RWStatus["EndRead"] = "end_read";
    RWStatus["BeginRead"] = "begin_read";
    RWStatus["LockingWriteKey"] = "locking_write_key";
    RWStatus["UnlockingWriteKey"] = "unlocking_write_key";
})(RWStatus || (exports.RWStatus = RWStatus = {}));
