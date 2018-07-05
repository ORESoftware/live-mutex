'use strict';

import * as suman from 'suman';
const {Test} = suman.init(module);
import {RWLockClient, Broker} from '../../dist';

///////////////////////////////////////////////////////////////

Test.create(['Promise', function (b, it, inject, describe, before, $deps) {

  console.log('suman child id:',process.env.SUMAN_CHILD_ID);

  const port = 7000 + parseInt(process.env.SUMAN_CHILD_ID || '1');
  const conf = Object.freeze({port});

  const writeKey = 'write-key';

  const handleEvents = function (v) {

    v.emitter.on('warning', w => {
      console.error('warning:', w);
    });

    v.emitter.on('error', w => {
      console.error('error:', w);
    });

    return v;
  };

  inject(() => {
    return {
      broker: new Broker(conf).ensure().then(handleEvents)
    }
  });


  before('get client', h => {
    return new RWLockClient(conf).ensure().then(function (client) {
      h.supply.client = handleEvents(client);
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
