'use strict';

import * as lmUtils from './utils';
import {routineEnter} from './routine';

export {lmUtils};
export {RWLockClient, RWLockReadPrefClient} from './rw-client';
export {RWLockWritePrefClient} from './rw-write-preferred-client';
export {Client, LMXClient, LvMtxClient} from './client';
export {Broker, LMXBroker, LvMtxBroker} from './broker';
export {Broker1, LMXBroker as LMXBroker1, LvMtxBroker as LvMtxBroker1} from './broker-1';
export {LMXHttpServer} from './http-server';
export {InProcessBridge, VirtualSocket} from './in-process-bridge';
export {routineEnter, initOtel, shutdownOtel, setOtelEnabled, isOtelEnabled} from './routine';
export {getLogLevel, setLogLevel, isLogLevelEnabled, LMX_LOG_LEVELS} from './log-level';
export type {LMXLogLevel} from './log-level';

export {LMXLockRequestError, LMXUnlockRequestError} from "./shared-internal";
export {LMXClientException, LMXClientLockException, LMXClientUnlockException} from "./exceptions";

// LMX wire-protocol enum + discriminated union. Cross-runtime ports
// of this protocol (Rust, Go, Dart, Gleam) all expose a request enum
// as their public type contract; this is the Node analogue. The
// string values match the legacy wire format byte-for-byte, so older
// brokers/clients keep interoperating.
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
