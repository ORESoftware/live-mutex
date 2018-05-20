'use strict';

import * as suman from 'suman';
const {Test} = suman.init(module);
global.Promise = require('bluebird');
import {Client, Broker} from '../../dist';

///////////////////////////////////////////////////////////////////////////////////////

Test.create(['Promise', function (b, it, inject, describe, before, $deps) {
  
  const {Promise} = b.ioc;
  const {chalk: colors} = $deps;
  const conf = Object.freeze({port: 7035});
  
  before(h => new Broker(conf).start());
  
  before('get client', h => {
    return new Client(conf).ensure().then(function (c) {
      h.supply.client = c;
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
    
    // const promhelper = function (unlock) {
    //   return new Promise(function (resolve, reject) {
    //     unlock(function (err) {
    //       err ? reject(err) : resolve();
    //     });
    //   });
    // };
    
    const makePromiseProvider = function (unlock) {
      return function (input: string) {
        return Promise.resolve(input).then(function () {
          return new Promise(function (resolve, reject) {
            unlock(function (err) {
              err ? reject(err) : resolve();
            });
          });
        });
      }
    };
    
    it('locks/unlocks super special 1', t => {
      const c = t.supply.client;
      return c.lockp('foo').then(function ({unlock}) {
        return (unlock);
      });
    });
    
    it('locks/unlocks super special 2', async t => {
      const c = t.supply.client as Client;
      const {unlock} = await c.acquire('foo');
      return c.promisifyUnlock(unlock);
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
        return new Promise(function (resolve, reject) {
          unlock(function (err) {
            err ? reject(err) : resolve();
          });
        });
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
