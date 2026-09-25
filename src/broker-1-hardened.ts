'use strict';

import {
  Broker1 as BaseBroker1,
  log,
  type IBrokerOptsPartial,
  type IErrorFirstCB,
  type LockObj,
  type LMXSocket,
} from './broker-1';

export {log};
export type {IBrokerOptsPartial, IErrorFirstCB, LockObj, LMXSocket};

/** Largest fencing token that can cross every maintained JSON/JavaScript client exactly. */
export const MAX_FENCING_TOKEN = Number.MAX_SAFE_INTEGER;

export class FencingTokenExhaustedError extends Error {
  constructor() {
    super(`live-mutex fencing-token authority exhausted at ${MAX_FENCING_TOKEN}; refusing to reuse or round authority`);
    this.name = 'FencingTokenExhaustedError';
  }
}

function configuredFloor(): number {
  const raw = process.env.LMX_FENCING_TOKEN_FLOOR;
  if (!raw) return 0;
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
    throw new Error('LMX_FENCING_TOKEN_FLOOR must be canonical non-negative decimal text');
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_FENCING_TOKEN) {
    throw new Error(`LMX_FENCING_TOKEN_FLOOR must be in 0..${MAX_FENCING_TOKEN}`);
  }
  return value;
}

/**
 * Production Broker1 facade with a broker-wide fencing high-watermark.
 *
 * The historical broker stored only a counter inside each LockObj. Idle-key GC
 * could delete that object, and its replacement was seeded from Date.now(). A
 * sufficiently busy key or a clock rollback could therefore regress authority.
 * This wrapper keeps a broker-wide high-watermark that survives LockObj GC and
 * makes every newly materialized key start at max(clock, configured floor,
 * process watermark). All writes to `nextFencingToken` go through a Proxy that
 * rejects non-monotonic, non-safe, or exhausted values before a holder record is
 * installed or an acquired response is emitted.
 *
 * Cross-process restart safety cannot be invented from wall clock. Deployments
 * that restart a standalone broker must persist the last reported watermark and
 * feed it back through `LMX_FENCING_TOKEN_FLOOR`; clustered/consensus deployments
 * should restore a committed watermark from their replicated state instead.
 */
export class Broker1 extends BaseBroker1 {
  private fencingTokenFloor = configuredFloor();
  private fencingWatermark = this.fencingTokenFloor;

  static create(opts: IBrokerOptsPartial): Broker1 {
    return new Broker1(opts);
  }

  getFencingWatermark(): number {
    return this.fencingWatermark;
  }

  getDefaultLockObject(
    key: string,
    keepLocksAfterDeath?: boolean,
    max?: number,
    maxRead?: number,
    maxWrite?: number,
  ): LockObj {
    const target = super.getDefaultLockObject(key, keepLocksAfterDeath, max, maxRead, maxWrite);
    const seed = Math.max(target.nextFencingToken, this.fencingTokenFloor, this.fencingWatermark);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_FENCING_TOKEN) {
      throw new FencingTokenExhaustedError();
    }
    target.nextFencingToken = seed;
    if (seed > this.fencingWatermark) this.fencingWatermark = seed;

    const self = this;
    return new Proxy(target, {
      set(obj, prop, value, receiver) {
        if (prop === 'nextFencingToken') {
          const current = obj.nextFencingToken;
          if (
            typeof value !== 'number' ||
            !Number.isSafeInteger(value) ||
            value <= current ||
            value > MAX_FENCING_TOKEN
          ) {
            throw new FencingTokenExhaustedError();
          }
          if (value > self.fencingWatermark) self.fencingWatermark = value;
        }
        return Reflect.set(obj, prop, value, receiver);
      },
    });
  }

  buildStatsSnapshot() {
    return {
      ...super.buildStatsSnapshot(),
      fencingWatermark: this.fencingWatermark,
      fencingTokenFloor: this.fencingTokenFloor,
      maxFencingToken: MAX_FENCING_TOKEN,
    };
  }

  renderPrometheus(): string {
    const base = super.renderPrometheus();
    return base
      + '# HELP lmx_fencing_watermark Highest fencing token observed by this broker process.\n'
      + '# TYPE lmx_fencing_watermark gauge\n'
      + `lmx_fencing_watermark ${this.fencingWatermark}\n`
      + '# HELP lmx_fencing_token_floor Restart floor supplied by durable/consensus state.\n'
      + '# TYPE lmx_fencing_token_floor gauge\n'
      + `lmx_fencing_token_floor ${this.fencingTokenFloor}\n`;
  }

  lock(data: any, ws: LMXSocket) {
    try {
      return super.lock(data, ws);
    } catch (error) {
      if (!(error instanceof FencingTokenExhaustedError)) throw error;
      this.send(ws, {
        type: 'lock',
        uuid: data?.uuid,
        key: data?.key,
        acquired: false,
        error: 'fencing_token_exhausted',
      });
      this.emitter.emit('warning', error.message);
    }
  }

  acquireMany(data: any, ws: LMXSocket) {
    try {
      return super.acquireMany(data, ws);
    } catch (error) {
      if (!(error instanceof FencingTokenExhaustedError)) throw error;
      this.send(ws, {
        type: 'acquire-many',
        uuid: data?.uuid,
        keys: Array.isArray(data?.keys) ? data.keys : [],
        acquired: false,
        error: 'fencing_token_exhausted',
      });
      this.emitter.emit('warning', error.message);
    }
  }

  ensureNewLockHolder(lck: LockObj, data: any) {
    try {
      return super.ensureNewLockHolder(lck, data);
    } catch (error) {
      if (!(error instanceof FencingTokenExhaustedError)) throw error;
      // A queued request has already been removed from the queue by the base
      // implementation. Do not reuse the last token merely to preserve
      // availability: fencing exhaustion is a terminal authority failure.
      this.emitter.emit('warning', error.message);
      return;
    }
  }
}

export const LvMtxBroker = Broker1;
export const LMXBroker = Broker1;
export default Broker1;
