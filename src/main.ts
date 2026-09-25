'use strict';

import * as lmUtils from './utils';
import {routineEnter} from './routine';

export {lmUtils};
export {RWLockClient, RWLockReadPrefClient} from './rw-client-hardened';
export {RWLockWritePrefClient} from './rw-write-preferred-client-hardened';
export {Client, LMXClient, LvMtxClient, InvalidFencingTokenError, assertFencingToken} from './client-hardened';
export {Broker, LMXBroker, LvMtxBroker} from './broker';
// Broker1 is the recommended broker. Export the hardened facade so public and
// packaged server entry points get high-watermark fencing and fail-closed
// token exhaustion by default. The historical implementation remains an
// internal base class in broker-1.ts.
export {Broker1, LMXBroker as LMXBroker1, LvMtxBroker as LvMtxBroker1} from './broker-1-hardened';
export {
  MAX_FENCING_TOKEN,
  FencingTokenExhaustedError,
  FencingTokenPersistenceError,
} from './broker-1-hardened';
export {LMXHttpServer} from './http-server';
export {InProcessBridge, VirtualSocket} from './in-process-bridge';
export {routineEnter, initOtel, shutdownOtel, setOtelEnabled, isOtelEnabled} from './routine';
export {getLogLevel, setLogLevel, isLogLevelEnabled, LMX_LOG_LEVELS} from './log-level';
export type {LMXLogLevel} from './log-level';

export {LMXLockRequestError, LMXUnlockRequestError} from "./shared-internal";
export {LMXClientException, LMXClientLockException, LMXClientUnlockException} from "./exceptions";
export {
  createTelemetryEvent,
  emitTelemetryEvent,
  emitEmitterInfoTelemetry,
  emitEmitterWarningTelemetry,
  LMXTelemetryEvent,
  LMXTelemetryInput,
  LMXTelemetrySeverity
} from "./telemetry";

export {
    LMXRequestType,
    LMXResponseType,
    LMXKnownRequestTypes,
    isLMXRequestType,
    assertExhaustive,
} from './protocol';
export type {
    LMXRequest,
    LockReq, UnlockReq, AcquireManyReq, ReleaseManyReq,
    LsReq, VersionReq, VersionMismatchConfirmedReq,
    SimulateVersionMismatchReq,
    EndConnectionFromBrokerForTestingReq,
    DestroyConnectionFromBrokerForTestingReq,
    IncrementReadersReq, DecrementReadersReq,
    RegisterWriteFlagCheckReq, RegisterWriteFlagCheckQueuedReq,
    RegisterWriteFlagAndReadersCheckReq,
    SetWriteFlagFalseAndBroadcastReq,
    LockReceivedReq, LockClientTimeoutReq, LockClientErrorReq,
    LockReceivedRejectedReq,
    LockInfoRequestReq, PingReq, SystemStatsRequestReq,
} from './protocol';

export const r2gSmokeTest = function () {
  const routineId = 'ddl-routine-r2gSmokeTest-Wj6';
  routineEnter(routineId, 'r2gSmokeTest');
  return true;
};
