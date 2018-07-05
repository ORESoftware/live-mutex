'use strict';

import * as lmUtils from './utils';
export {lmUtils};
export {Broker, LMXBroker, LvMtxBroker} from './broker';
export {RWLockClient, RWLockReadPrefClient} from './rw-client';
export {RWLockWritePrefClient} from './rw-write-preferred-client';
export {Client, LMXClient, LvMtxClient} from './client';


export enum LMXLockRequestError {
  GenericLockError = 'generic_lock_error',
  MaxRetries = 'max_retries',
  RequestTimeoutError = 'request_timeout',
  BadArgumentsError = 'bad_args',
  InternalError = 'internal_error',
  UnknownException = 'unknown_exception',
  WaitOptionSetToFalse = 'wait_option_is_false'
}

export enum LMXUnlockRequestError {
  BadOrMismatchedId = 'bad_or_mismatched_id',
  UnknownException = 'unknown_exception',
  InternalError = 'internal_error',
  GeneralUnlockError = 'general_unlock_error'
}

export const r2gSmokeTest = function () {
  return true;
};