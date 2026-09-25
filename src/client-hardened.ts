'use strict';

import {
  Client as BaseClient,
  type ClientOpts,
  type LMClientCallBack,
  type LMClientLockCallBack,
  type LMXClientLockOpts,
  type LMLockSuccessData,
} from './client';

export type {
  ClientOpts,
  EndReadCallback,
  LMClientCallBack,
  LMXClientLockOpts,
  LMXClientUnlockOpts,
  LMLockSuccessData,
  LMUnlockSuccessData,
  LMClientLockCallBack,
  LMClientUnlockCallBack,
} from './client';

export const MAX_FENCING_TOKEN = Number.MAX_SAFE_INTEGER;

export class InvalidFencingTokenError extends Error {
  constructor(value: unknown) {
    super(`live-mutex acquired a lock without an exact fencing token in 1..${MAX_FENCING_TOKEN}: ${String(value)}`);
    this.name = 'InvalidFencingTokenError';
  }
}

export function assertFencingToken(value: unknown): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_FENCING_TOKEN
  ) {
    throw new InvalidFencingTokenError(value);
  }
}

/**
 * Public client facade for Broker1.
 *
 * The historical client tolerated brokers that predated fencing and surfaced a
 * successful grant with `fencingToken = null`. That is unsafe for callers that
 * use the grant to mutate external state: a success without fenced authority is
 * not a usable protected critical section. The hardened facade wraps every
 * callback-based `lock()` result (and therefore `acquire()`, which is built on
 * `lock`) and turns a missing/malformed/rounded fence into an acquisition error.
 */
export class Client extends BaseClient {
  constructor(o?: Partial<ClientOpts>, cb?: LMClientCallBack) {
    super(o, cb);
  }

  lock(...args: any[]): void {
    const cbIndex = args.length - 1;
    const cb = args[cbIndex] as LMClientLockCallBack;
    if (typeof cb !== 'function') {
      return (super.lock as any)(...args);
    }
    const wrapped = (err: any, value: LMLockSuccessData) => {
      if (err) return cb(err, value);
      try {
        assertFencingToken(value?.fencingToken);
      } catch (cause) {
        return cb(cause as any, value);
      }
      return cb(null as any, value);
    };
    const forwarded = args.slice();
    forwarded[cbIndex] = wrapped;
    return (super.lock as any)(...forwarded);
  }
}

export const LMXClient = Client;
export const LvMtxClient = Client;
export default Client;
