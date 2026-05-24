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
export {InProcessBridge} from './in-process-bridge';
export {routineEnter, initOtel, shutdownOtel, setOtelEnabled, isOtelEnabled} from './routine';

export {LMXLockRequestError, LMXUnlockRequestError} from "./shared-internal";
export {LMXClientException, LMXClientLockException, LMXClientUnlockException} from "./exceptions";

export const r2gSmokeTest = function () {
  const routineId = 'ddl-routine-r2gSmokeTest-Wj6';
  routineEnter(routineId, 'r2gSmokeTest');
  return true;
};
