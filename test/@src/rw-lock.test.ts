'use strict';

import * as suman from 'suman';
const {Test} = suman.init(module);
import {Broker, Client} from '../../dist';

///////////////////////////////////////////////////////////////

Test.create(['Promise', function (b, it, inject, describe, before, $deps) {


  const conf = Object.freeze({port: 7000});
  const writeKey = 'write-key';

  inject(() => {
    return {
      broker: new Broker(conf).ensure()
    }
  });


  before('get client', h => {
    return new Client(conf).ensure().then(function (client) {
      h.supply.client = client;
    });
  });

  describe('injected', function (b) {

    it.cb('locks/unlocks', t => {

      const c = t.supply.client;

      c.beginRead('a', {writeKey}, function (err, v) {

        console.error('here is args 1:,', err, v);

        if (err) {
          return t.fail(err);
        }

        setTimeout(function () {
          c.endRead('a', {writeKey},(err,val) => {
            console.error('here is args 2:,', err, val);

            if(err.match(/no lock with key/)){
              err =null;
            }

            t.done(err);
          });
        }, 1500);

      });

    });

    // it.cb('locks/unlocks', t => {
    //
    //   const c = t.supply.client;
    //
    //   c.beginRead('a', {writeKey}, function (err, v) {
    //
    //     if (err) {
    //       return t.fail(err);
    //     }
    //
    //     setTimeout(function () {
    //       c.endRead('a', t.done);
    //     }, 1000);
    //
    //   });
    //
    // });
    //
    // it.cb('locks/unlocks', t => {
    //
    //   const c = t.supply.client;
    //
    //   c.beginWrite(writeKey, function (err, v) {
    //
    //     if (err) {
    //       return t.fail(err);
    //     }
    //
    //     setTimeout(function () {
    //       c.endWrite(writeKey, t.done);
    //     }, 1000);
    //
    //   });
    // });
    //
    // it.cb('locks/unlocks', t => {
    //
    //   const c = t.supply.client;
    //
    //   c.beginRead('a', {writeKey}, function (err, v) {
    //
    //     if (err) {
    //       return t.fail(err);
    //     }
    //
    //     setTimeout(function () {
    //       c.endRead('a', t.done);
    //     }, 1000);
    //
    //   });
    // });

  });

}]);
