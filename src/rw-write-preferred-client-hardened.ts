'use strict';

import {RWLockWritePrefClient as BaseRWLockWritePrefClient} from './rw-write-preferred-client';
import {assertFencingToken} from './client-hardened';
import type {ClientOpts, LMClientCallBack, LMClientLockCallBack, LMLockSuccessData} from './client';

/** Write-preferred RW client with strict authority-bearing lock grants. */
export class RWLockWritePrefClient extends BaseRWLockWritePrefClient {
  constructor(o?: Partial<ClientOpts>, cb?: LMClientCallBack) {
    super(o, cb);
  }

  lock(...args: any[]): void {
    const cbIndex = args.length - 1;
    const cb = args[cbIndex] as LMClientLockCallBack;
    if (typeof cb !== 'function') return (super.lock as any)(...args);
    const forwarded = args.slice();
    forwarded[cbIndex] = (err: any, value: LMLockSuccessData) => {
      if (err) return cb(err, value);
      try {
        assertFencingToken(value?.fencingToken);
      } catch (cause) {
        return cb(cause as any, value);
      }
      return cb(null as any, value);
    };
    return (super.lock as any)(...forwarded);
  }
}

export default RWLockWritePrefClient;
