#!/usr/bin/env ts-node

'use strict';

import * as assert from 'assert';
import {Broker1} from '../src/broker-1';
import {Client} from '../src/client';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const closeBroker = (broker: Broker1): Promise<any> => {
  return new Promise(resolve => {
    broker.close((err: any) => resolve(err));
  });
};

const testClientCloseClearsInFlightState = async () => {
  const client = new Client() as any;
  let prematureCallbacks = 0;
  let timerFired = false;

  client.resolutions.set('uuid-1', (err: any, val: any) => {
    prematureCallbacks++;
    assert.ok(err);
    assert.ok(/closed|premature/i.test(String(err.message || err)));
    assert.strictEqual(val, err);
    assert.strictEqual(err.forcePrematureCallback, true);
  });
  client.timers['uuid-1'] = setTimeout(() => {
    timerFired = true;
  }, 25);
  client.timeouts['uuid-1'] = true;
  client.giveups['uuid-1'] = true;
  client.emitter.on('warning', () => {
    // Deliberately present so close() proves it removes user listeners too.
  });

  assert.strictEqual(client.resolutions.size, 1);
  assert.strictEqual(Object.keys(client.timers).length, 1);
  assert.strictEqual(Object.keys(client.timeouts).length, 1);
  assert.strictEqual(Object.keys(client.giveups).length, 1);
  assert.ok(client.emitter.listenerCount('warning') >= 3);

  client.close();
  await delay(40);

  assert.strictEqual(prematureCallbacks, 1);
  assert.strictEqual(timerFired, false);
  assert.strictEqual(client.resolutions.size, 0);
  assert.strictEqual(Object.keys(client.timers).length, 0);
  assert.strictEqual(Object.keys(client.timeouts).length, 0);
  assert.strictEqual(Object.keys(client.giveups).length, 0);
  assert.strictEqual(client.emitter.listenerCount('warning'), 0);
};

const testBrokerCloseClearsBookkeeping = async () => {
  const broker = new Broker1({noListen: true}) as any;
  let holderTimerFired = false;
  let brokerTimeoutFired = false;
  let destroyedSockets = 0;

  const fakeSocket = {
    destroy() {
      destroyedSockets++;
    },
    removeAllListeners() {},
    lmxClosed: false
  };

  const holderTimer = setTimeout(() => {
    holderTimerFired = true;
  }, 25);

  const brokerTimeout = setTimeout(() => {
    brokerTimeoutFired = true;
  }, 25);

  const lockObj = broker.getDefaultLockObject('cleanup-key', false, 1);
  lockObj.lockholders.set('holder-uuid', {
    pid: process.pid,
    ws: fakeSocket,
    uuid: 'holder-uuid',
    timer: holderTimer
  });

  broker.timeouts['cleanup-key'] = brokerTimeout;
  broker.locks.set('cleanup-key', lockObj);
  broker.connectedClients.add(fakeSocket);
  broker.wsToKeys.set(fakeSocket, {'cleanup-key': true});
  broker.wsToUUIDs.set(fakeSocket, {'holder-uuid': true});
  broker.rejected['holder-uuid'] = true;
  broker.registeredListeners['cleanup-key'] = [{
    ws: fakeSocket,
    uuid: 'listener-uuid',
    key: 'cleanup-key',
    fn() {}
  }];

  assert.strictEqual(broker.locks.size, 1);
  assert.strictEqual(broker.connectedClients.size, 1);
  assert.strictEqual(broker.wsToKeys.size, 1);
  assert.strictEqual(broker.wsToUUIDs.size, 1);
  assert.strictEqual(Object.keys(broker.rejected).length, 1);
  assert.strictEqual(Object.keys(broker.registeredListeners).length, 1);

  await closeBroker(broker);
  await delay(40);

  assert.strictEqual(destroyedSockets, 1);
  assert.strictEqual(holderTimerFired, false);
  assert.strictEqual(brokerTimeoutFired, false);
  assert.strictEqual(broker.locks.size, 0);
  assert.strictEqual(broker.connectedClients.size, 0);
  assert.strictEqual(broker.wsToKeys.size, 0);
  assert.strictEqual(broker.wsToUUIDs.size, 0);
  assert.strictEqual(Object.keys(broker.rejected).length, 0);
  assert.strictEqual(Object.keys(broker.registeredListeners).length, 0);
};

const main = async () => {
  await testClientCloseClearsInFlightState();
  await testBrokerCloseClearsBookkeeping();
  console.log('cleanup-hardening-test passed');
};

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
