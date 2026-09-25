'use strict';

import * as fs from 'fs';
import * as path from 'path';
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
const FENCING_STATE_SCHEMA = 'live-mutex.fencing-watermark/v1';
const FENCING_STATE_PATH_ENV = 'LMX_FENCING_TOKEN_STATE_PATH';

export class FencingTokenExhaustedError extends Error {
  readonly code = 'fencing_token_exhausted';

  constructor() {
    super(`live-mutex fencing-token authority exhausted at ${MAX_FENCING_TOKEN}; refusing to reuse or round authority`);
    this.name = 'FencingTokenExhaustedError';
  }
}

export class FencingTokenPersistenceError extends Error {
  readonly code = 'fencing_token_persistence_failed';

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'FencingTokenPersistenceError';
    if (cause !== undefined) {
      (this as any).cause = cause;
    }
  }
}

function parseWatermarkText(raw: unknown, source: string): number {
  if (typeof raw !== 'string' || !/^(0|[1-9][0-9]*)$/.test(raw)) {
    throw new FencingTokenPersistenceError(`${source} must contain a canonical non-negative decimal fencing watermark`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_FENCING_TOKEN) {
    throw new FencingTokenPersistenceError(`${source} fencing watermark must be in 0..${MAX_FENCING_TOKEN}`);
  }

  return value;
}

function configuredFloor(): number {
  const raw = process.env.LMX_FENCING_TOKEN_FLOOR;
  if (!raw) {
    return 0;
  }

  return parseWatermarkText(raw, 'LMX_FENCING_TOKEN_FLOOR');
}

function configuredStatePath(): string | null {
  const raw = process.env[FENCING_STATE_PATH_ENV];
  if (!raw) {
    return null;
  }

  return path.resolve(raw);
}

function readPersistedWatermark(statePath: string | null): number {
  if (!statePath) {
    return 0;
  }

  if (!fs.existsSync(statePath)) {
    return 0;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  catch (error) {
    throw new FencingTokenPersistenceError(`could not read durable fencing state at ${statePath}`, error);
  }

  if (!parsed || parsed.schema !== FENCING_STATE_SCHEMA) {
    throw new FencingTokenPersistenceError(`durable fencing state at ${statePath} has an unsupported schema`);
  }

  return parseWatermarkText(parsed.watermark, `durable fencing state at ${statePath}`);
}

function fsyncDirectoryBestEffort(directoryPath: string): void {
  let directoryFd: number | null = null;
  try {
    directoryFd = fs.openSync(directoryPath, 'r');
    fs.fsyncSync(directoryFd);
  }
  catch (error: any) {
    if (error && (error.code === 'EINVAL' || error.code === 'ENOTSUP' || error.code === 'EPERM' || error.code === 'EISDIR')) {
      return;
    }
    throw error;
  }
  finally {
    if (directoryFd !== null) {
      fs.closeSync(directoryFd);
    }
  }
}

function persistWatermarkAtomically(statePath: string, watermark: number): void {
  const directoryPath = path.dirname(statePath);
  fs.mkdirSync(directoryPath, {recursive: true, mode: 0o700});

  const tempPath = `${statePath}.${process.pid}.tmp`;
  const payload = JSON.stringify({
    schema: FENCING_STATE_SCHEMA,
    watermark: String(watermark),
  }) + '\n';

  let fd: number | null = null;
  try {
    fd = fs.openSync(tempPath, 'w', 0o600);
    fs.writeFileSync(fd, payload, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tempPath, statePath);
    fsyncDirectoryBestEffort(directoryPath);
  }
  catch (error) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      }
      catch {
        // Preserve the original persistence failure.
      }
    }
    try {
      fs.unlinkSync(tempPath);
    }
    catch {
      // Preserve the original persistence failure.
    }
    throw new FencingTokenPersistenceError(`could not persist fencing watermark ${watermark} at ${statePath}`, error);
  }
}

/**
 * Production Broker1 facade with a broker-wide fencing high-watermark.
 *
 * The historical broker stored only a counter inside each LockObj. Idle-key GC
 * could delete that object, and its replacement was seeded from Date.now(). A
 * sufficiently busy key or a clock rollback could therefore regress authority.
 * This facade keeps a broker-wide high-watermark that survives LockObj GC and
 * makes every newly materialized key start at max(clock, configured floor,
 * process watermark, durable watermark). All writes to `nextFencingToken` go
 * through a Proxy that rejects non-monotonic, non-safe, or exhausted values
 * before a holder record is installed or an acquired response is emitted.
 *
 * Set `LMX_FENCING_TOKEN_STATE_PATH` to enable durable standalone-broker mode.
 * Every higher watermark is fsync'd to a temporary file and atomically renamed
 * into place BEFORE the in-memory authority advances. Crashes may therefore
 * create harmless gaps, but a restarted broker cannot regress below an already
 * persisted token. `LMX_FENCING_TOKEN_FLOOR` remains a manual/consensus restore
 * input and is combined with the durable file using max().
 */
export class Broker1 extends BaseBroker1 {
  // BaseBroker1 installs these callback/promise properties in its constructor.
  // Narrow their resolved value back to the public hardened subtype so callers
  // cannot accidentally lose access to the hardened observability surface.
  declare ensure: (cb?: any) => Promise<Broker1>;
  declare start: (cb?: any) => Promise<Broker1>;

  private fencingTokenFloor = configuredFloor();
  private fencingStatePath = configuredStatePath();
  private fencingWatermark = Math.max(
    this.fencingTokenFloor,
    readPersistedWatermark(this.fencingStatePath),
  );

  static create(opts: IBrokerOptsPartial): Broker1 {
    return new Broker1(opts);
  }

  getFencingWatermark(): number {
    return this.fencingWatermark;
  }

  isDurableFencingMode(): boolean {
    return this.fencingStatePath !== null;
  }

  private persistFencingWatermark(value: number): void {
    if (!this.fencingStatePath) {
      return;
    }

    persistWatermarkAtomically(this.fencingStatePath, value);
  }

  private hasHeadroom(requiredTokens: number): boolean {
    return Number.isSafeInteger(requiredTokens)
      && requiredTokens >= 0
      && requiredTokens <= MAX_COMPOSITE_KEYS
      && this.fencingWatermark <= MAX_FENCING_TOKEN - requiredTokens;
  }

  private emitAuthorityFailure(
    ws: LMXSocket,
    data: any,
    type: 'lock' | 'acquire-many',
    error: FencingTokenExhaustedError | FencingTokenPersistenceError,
  ): void {
    this.send(ws, {
      type,
      uuid: data?.uuid,
      ...(type === 'lock'
        ? {key: data?.key}
        : {keys: Array.isArray(data?.keys) ? data.keys : []}),
      acquired: false,
      error: error.code,
    });
    this.emitter.emit('warning', error.message);
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
    if (seed > this.fencingWatermark) {
      this.persistFencingWatermark(seed);
      this.fencingWatermark = seed;
    }

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
          if (value > self.fencingWatermark) {
            self.persistFencingWatermark(value);
            self.fencingWatermark = value;
          }
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
      durableFencingMode: this.isDurableFencingMode(),
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
      + `lmx_fencing_token_floor ${this.fencingTokenFloor}\n`
      + '# HELP lmx_fencing_durable_mode 1 when the broker persists the watermark before grants.\n'
      + '# TYPE lmx_fencing_durable_mode gauge\n'
      + `lmx_fencing_durable_mode ${this.isDurableFencingMode() ? 1 : 0}\n`;
  }

  lock(data: any, ws: LMXSocket) {
    if (!this.hasHeadroom(1)) {
      this.emitAuthorityFailure(ws, data, 'lock', new FencingTokenExhaustedError());
      return;
    }
    try {
      return super.lock(data, ws);
    }
    catch (error) {
      if (error instanceof FencingTokenExhaustedError || error instanceof FencingTokenPersistenceError) {
        this.emitAuthorityFailure(ws, data, 'lock', error);
        return;
      }
      throw error;
    }
  }

  acquireMany(data: any, ws: LMXSocket) {
    const required = Array.isArray(data?.keys)
      ? new Set(data.keys.filter((k: unknown) => typeof k === 'string')).size
      : 1;
    if (!this.hasHeadroom(required)) {
      this.emitAuthorityFailure(ws, data, 'acquire-many', new FencingTokenExhaustedError());
      return;
    }
    try {
      return super.acquireMany(data, ws);
    }
    catch (error) {
      if (error instanceof FencingTokenExhaustedError || error instanceof FencingTokenPersistenceError) {
        this.emitAuthorityFailure(ws, data, 'acquire-many', error);
        return;
      }
      throw error;
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
    }
    catch (error) {
      if (error instanceof FencingTokenExhaustedError || error instanceof FencingTokenPersistenceError) {
        this.emitter.emit('warning', error.message);
        return;
      }
      throw error;
    }
  }
}

export const LvMtxBroker = Broker1;
export const LMXBroker = Broker1;
export default Broker1;
