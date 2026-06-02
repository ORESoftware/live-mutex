'use strict';

import * as lmUtils from './utils';

export {lmUtils};
export {RWLockClient, RWLockReadPrefClient} from './rw-client';
export {RWLockWritePrefClient} from './rw-write-preferred-client';
export {Client, LMXClient, LvMtxClient} from './client';
export {Broker, LMXBroker, LvMtxBroker} from './broker';
export {Broker1, LMXBroker as LMXBroker1, LvMtxBroker as LvMtxBroker1} from './broker-1';

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

export const r2gSmokeTest = function () {
  return true;
};
