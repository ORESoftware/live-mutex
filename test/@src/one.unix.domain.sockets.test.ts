'use strict';

import * as suman from 'suman';
const {Test} = suman.init(module);
import {Broker, Client} from '../../dist';

///////////////////////////////////////////////////////////////

Test.create(['Promise', function (b, it, inject, describe, before, $deps, path) {

  const {Promise} = b.ioc;
  const {chalk: colors} = $deps;

  console.log('suman child id:',process.env.SUMAN_CHILD_ID);

  const conf = Object.freeze({udsPath: path.resolve(process.env.HOME + '/suman.test.unix.sock')});


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
    return new Client(conf).ensure().then(function (client) {
      h.supply.client = handleEvents(client);
    });
  });

  describe('injected', function (b) {

    it.cb('locks/unlocks', t => {

      const c = t.supply.client;

      c.lock('a', {}, function (err, v) {

        if (err) {
          return t.fail(err);
        }

        setTimeout(function () {
          v.unlock(t.done);
        }, 1500);

      });

    });

    it.cb('locks/unlocks', t => {

      const c = t.supply.client;

      c.lock('a', 1100, function (err, v) {

        if (err) {
          return t.fail(err);
        }

        setTimeout(function () {
          c.unlock('a', v.lockUuid, t.done);
        }, 1000);

      });

    });

    it.cb('locks/unlocks', t => {

      const c = t.supply.client;

      c.lock('a', {}, function (err, v) {

        if (err) {
          return t.fail(err);
        }

        setTimeout(function () {
          c.unlock('a', t.done);
        }, 1000);

      });
    });

  });

}]);
