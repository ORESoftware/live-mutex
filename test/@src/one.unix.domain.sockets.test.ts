'use strict';

import * as suman from 'suman';
const {Test} = suman.init(module);
import {Broker, Client} from '../../dist';

///////////////////////////////////////////////////////////////

Test.create(['Promise', function (b, it, inject, describe, before, $deps, path) {

  const {Promise} = b.ioc;
  const {chalk: colors} = $deps;
  const conf = Object.freeze({udsPath: path.resolve(process.env.HOME + '/suman.test.unix.sock')});

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
