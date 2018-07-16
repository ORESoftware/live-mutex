'use strict';

import * as util from "util";
import {LMXLockRequestError, LMXUnlockRequestError} from "./shared-internal";

export class LMXClientLockException {

  code: LMXLockRequestError;
  message: string;
  key: string;
  id: string;
  stack: string;

  constructor(key: string, id: string, code: LMXLockRequestError, message: string) {
    this.id = id;
    this.key = key;
    this.code = code;

    if (typeof message !== 'string') {
      message = util.inspect(message, {breakLength: Infinity});
    }

    this.message = message;
    this.stack = message;
  }

}

export class LMXClientUnlockException {

  code: LMXUnlockRequestError;
  message: string;
  key: string;
  id: string;
  stack: string;

  constructor(key: string, id: string, code: LMXUnlockRequestError, message: string) {
    this.id = id;
    this.key = key;
    this.code = code;

    if (typeof message !== 'string') {
      message = util.inspect(message, {breakLength: Infinity});
    }

    this.message = message;
    this.stack = message;
  }

}