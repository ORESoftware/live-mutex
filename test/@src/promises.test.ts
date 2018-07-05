'use strict';

import * as suman from 'suman';
const {Test} = suman.init(module);
global.Promise = require('bluebird');
import {Client, Broker} from '../../dist';

///////////////////////////////////////////////////////////////////////////////////////

Test.create(['Promise', function (b, it, inject, describe, before, $deps) {

  const {Promise} = b.ioc;
  const {chalk: colors} = $deps;

  console.log('suman child id:',process.env.SUMAN_CHILD_ID);

  const port = 7000 + parseInt(process.env.SUMAN_CHILD_ID || '1');
  const conf = Object.freeze({port});

  const handleEvents = function (v) {

    v.emitter.on('warning', w => {
      console.error('warning:', w);
    });

    v.emitter.on('error', w => {
      console.error('error:', w);
    });

    return v;
  };

  before(h => new Broker(conf).start().then(handleEvents));

  before('get client', h => {
    return new Client(conf).ensure().then(function (c) {
      h.supply.client = handleEvents(c);
    });
  });

  describe('do all in parallel', {parallel: true}, b => {

    describe('injected', function (b) {
      it('locks/unlocks', t => {
        const c = t.supply.client as Client;
        return c.lockp('a').then(function (v) {
          return c.unlockp('a');
        });
      });
    });

    it('locks/unlocks', t => {
      const c = t.supply.client as Client;
      return c.lockp('a').then(function (v) {
        return c.unlockp('a');
      });
    });

    const makePromiseProvider = function (unlock) {
      return function (input: string) {
        return new Promise(function (resolve, reject) {
          unlock(function (err) {
            err ? reject(err) : resolve();
          });
        });
      }
    };

    it('locks/unlocks super special 1', t => {
      const c = t.supply.client;
      return c.lockp('foo').then(function (unlock) {
        return c.runUnlock(unlock);
      });
    });

    it('locks/unlocks super special 2', async t => {
      const c = t.supply.client as Client;
      const {unlock} = await c.acquire('foo');
      return c.execUnlock(unlock);
    });

    it('locks/unlocks super special 2', async t => {
      const c = t.supply.client;
      const {unlock} = await c.lockp('foo');
      const provider = makePromiseProvider(unlock);
      // do some other async stuff
      const v = await Promise.resolve(123);
      return provider(String(v));
    });

    it('locks/unlocks super special 3', t => {
      const c = t.supply.client;
      return c.lockp('foo').then(function ({unlock}) {
        return new Promise((resolve, reject) =>
          unlock((e, v) => e ? reject(e) : resolve(v)));
      });
    });

    it('locks/unlocks', async t => {
      const c = t.supply.client;
      await c.lockp('a');
      await Promise.delay(100);
      return c.unlockp('a');
    });

  });

}]);
