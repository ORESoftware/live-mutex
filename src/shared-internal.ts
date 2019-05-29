

export const forDebugging = {
   previousTime : Date.now()
};


export enum LMXClientError {
  VersionMismatch = 'version_mismatch',
  UnknownError = 'unknown_error'
}

export enum LMXLockRequestError {
  GenericLockError = 'generic_lock_error',
  MaxRetries = 'max_retries',
  RequestTimeoutError = 'request_timeout',
  BadArgumentsError = 'bad_args',
  InternalError = 'internal_error',
  UnknownException = 'unknown_exception',
  WaitOptionSetToFalse = 'wait_option_is_false',
  CannotContinue = 'cannot_continue',
  ConnectionClosed = 'connection_closed'
}

export enum LMXUnlockRequestError {
  BadOrMismatchedId = 'bad_or_mismatched_id',
  UnknownException = 'unknown_exception',
  InternalError = 'internal_error',
  GeneralUnlockError = 'general_unlock_error'
}


export enum RWStatus {
  EndWrite = 'end_write',
  BeginWrite = 'begin_write',
  EndRead = 'end_read',
  BeginRead = 'begin_read',
  LockingWriteKey = 'locking_write_key',
  UnlockingWriteKey = 'unlocking_write_key'
}
