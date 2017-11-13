'use strict';

import * as suman from 'suman';
const {Test} = suman.init(module);
const Promise = require('bluebird');

///////////////////////////////////////////////////////////////////////////////////////

Test.create(['Broker', 'Client', function (b, it, inject, describe, before, $deps) {

  const {Broker, Client} = b.ioc;
  const {chalk: colors} = $deps;
  const conf = Object.freeze({port: 7035});

  before(h => new Broker(conf).start());

  before('get client', h => {
    return new Client(conf).ensure().then(function (c) {
      h.$inject.client = c;
    });
  });

  describe('injected', function (b) {
    it('locks/unlocks', t => {
      const c = t.$inject.client;
      return c.lockp('a').then(function (v) {
        return c.unlockp('a');
      });
    });
  });

  it('locks/unlocks', t => {
    const c = t.$inject.client;
    return c.lockp('a').then(function (v) {
      return c.unlockp('a');
    });
  });

  it('locks/unlocks', async t => {
    const c = t.$inject.client;
    await c.lockp('a');
    await Promise.delay(100);
    return c.unlockp('a');
  });

}]);
