'use strict';

import * as util from "util";
import {LMXLockRequestError, LMXUnlockRequestError} from "./shared-internal";
import {LMXClientError} from "./shared-internal";


export class LMXClientException {
  
  code: LMXClientError;
  message: string;
  key: string;
  id: string;
  stack: string;
  originalError: any;
  
  constructor(key: string, id: string, code: LMXClientError, message: string, originalError:any) {
    this.id = id;
    this.key = key;
    this.code = code;
    this.originalError = originalError;
    
    
    if (typeof message !== 'string') {
      message = util.inspect(message, {breakLength: Infinity});
    }
    
    this.message = message;
    this.stack = message;
  }
  
}

export class LMXClientLockException extends Error {

  code: LMXLockRequestError;
  key: string;
  id: string;

  constructor(key: string, id: string, code: LMXLockRequestError, message: string) {
    super(message);
    this.name = 'LMXClientLockException';
    this.id = id;
    this.key = key;
    this.code = code;

    if (typeof message !== 'string') {
      message = util.inspect(message, {breakLength: Infinity});
    }

    this.message = message;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LMXClientLockException);
    }
  }

}

export class LMXClientUnlockException extends Error {

  code: LMXUnlockRequestError;
  key: string;
  id: string;

  constructor(key: string, id: string, code: LMXUnlockRequestError, message: string) {
    super(message);
    this.name = 'LMXClientUnlockException';
    this.id = id;
    this.key = key;
    this.code = code;

    if (typeof message !== 'string') {
      message = util.inspect(message, {breakLength: Infinity});
    }

    this.message = message;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LMXClientUnlockException);
    }
  }

}