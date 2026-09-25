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
/** Broker1 caps acquire-many requests at 64 keys. Reserve that much headroom when draining queues. */
const MAX_COMPOSITE_KEYS = 64;

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
 * This facade keeps a broker-wide high-watermark that survives LockObj GC and
 * makes every newly materialized key start at max(clock, configured floor,
 * process watermark). All writes to `nextFencingToken` go through a Proxy that
 * rejects non-monotonic, non-safe, or exhausted values before a holder record is
 * installed or an acquired response is emitted.
 *
 * Cross-process restart safety cannot be invented from wall clock. Deployments
 * that restart a standalone broker must persist the last reported watermark and
 * feed it back through `LMX_FENCING_TOKEN_FLOOR`; clustered/consensus deployments
 * should restore a committed watermark from replicated state instead.
 */
export class Broker1 extends BaseBroker1 {
  // BaseBroker1 installs these callback/promise properties in its constructor.
  // Narrow their resolved value back to the public hardened subtype so callers
  // cannot accidentally lose access to the hardened observability surface.
  declare ensure: (cb?: any) => Promise<Broker1>;
  declare start: (cb?: any) => Promise<Broker1>;

  private fencingTokenFloor = configuredFloor();
  private fencingWatermark = this.fencingTokenFloor;

  static create(opts: IBrokerOptsPartial): Broker1 {
    return new Broker1(opts);
  }

  getFencingWatermark(): number {
    return this.fencingWatermark;
  }

  private hasHeadroom(requiredTokens: number): boolean {
    return Number.isSafeInteger(requiredTokens)
      && requiredTokens >= 0
      && requiredTokens <= MAX_COMPOSITE_KEYS
      && this.fencingWatermark <= MAX_FENCING_TOKEN - requiredTokens;
  }

  private emitExhausted(ws: LMXSocket, data: any, type: 'lock' | 'acquire-many'): void {
    this.send(ws, {
      type,
      uuid: data?.uuid,
      ...(type === 'lock'
        ? {key: data?.key}
        : {keys: Array.isArray(data?.keys) ? data.keys : []}),
      acquired: false,
      error: 'fencing_token_exhausted',
    });
    this.emitter.emit('warning', new FencingTokenExhaustedError().message);
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
    if (!this.hasHeadroom(1)) {
      this.emitExhausted(ws, data, 'lock');
      return;
    }
    try {
      return super.lock(data, ws);
    } catch (error) {
      if (!(error instanceof FencingTokenExhaustedError)) throw error;
      this.emitExhausted(ws, data, 'lock');
    }
  }

  acquireMany(data: any, ws: LMXSocket) {
    const required = Array.isArray(data?.keys)
      ? new Set(data.keys.filter((k: unknown) => typeof k === 'string')).size
      : 1;
    if (!this.hasHeadroom(required)) {
      this.emitExhausted(ws, data, 'acquire-many');
      return;
    }
    try {
      return super.acquireMany(data, ws);
    } catch (error) {
      if (!(error instanceof FencingTokenExhaustedError)) throw error;
      this.emitExhausted(ws, data, 'acquire-many');
    }
  }

  ensureNewLockHolder(lck: LockObj, data: any) {
    // BaseBroker1 can drain multiple normal waiters or one queued composite in
    // this call. Stop before the final 64-token window so an acquire-many grant
    // can never exhaust midway and leave a partial authority set behind.
    if (!this.hasHeadroom(MAX_COMPOSITE_KEYS)) {
      this.emitter.emit('warning', new FencingTokenExhaustedError().message);
      return;
    }
    try {
      return super.ensureNewLockHolder(lck, data);
    } catch (error) {
      if (!(error instanceof FencingTokenExhaustedError)) throw error;
      this.emitter.emit('warning', error.message);
      return;
    }
  }
}

export const LvMtxBroker = Broker1;
export const LMXBroker = Broker1;
export default Broker1;
