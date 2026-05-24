'use strict';


import {routineEnter} from './routine';
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
    const routineId = 'ddl-routine-wE054QKEBKlG02y40b';
    routineEnter(routineId, "LMXClientException.constructor");
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
    const routineId = 'ddl-routine-9txeQhZtHSb59vuaYW';
    routineEnter(routineId, "LMXClientLockException.constructor");
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
    const routineId = 'ddl-routine-eihZdNvGAgpiuuPN_U';
    routineEnter(routineId, "LMXClientUnlockException.constructor");
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