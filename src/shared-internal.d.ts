export type EVCb<T, E = any> = (err: E, val?: T) => void;
export declare const forDebugging: {
    previousTime: number;
};
export declare const inspectError: (err: any) => string;
export declare const joinToStr: (...args: any[]) => string;
export declare enum LMXClientError {
    VersionMismatch = "version_mismatch",
    UnknownError = "unknown_error"
}
export declare enum LMXLockRequestError {
    ConnectionRecovering = "connection_is_recovering",
    GenericLockError = "generic_lock_error",
    MaxRetries = "max_retries",
    RequestTimeoutError = "request_timeout",
    BadArgumentsError = "bad_args",
    InternalError = "internal_error",
    UnknownException = "unknown_exception",
    WaitOptionSetToFalse = "wait_option_is_false",
    CannotContinue = "cannot_continue",
    ConnectionClosed = "connection_closed"
}
export declare enum LMXUnlockRequestError {
    BadOrMismatchedId = "bad_or_mismatched_id",
    UnknownException = "unknown_exception",
    InternalError = "internal_error",
    GeneralUnlockError = "general_unlock_error"
}
export declare enum RWStatus {
    EndWrite = "end_write",
    BeginWrite = "begin_write",
    EndRead = "end_read",
    BeginRead = "begin_read",
    LockingWriteKey = "locking_write_key",
    UnlockingWriteKey = "unlocking_write_key"
}
