'use strict';
import suman from 'suman';
const Test = suman.init(module);

///////////////////////////////////////////////////////////////

Test.create(function (it, Broker, Client, inject, describe, before, $deps) {

  const {chalk: colors} = $deps;
  const conf = Object.freeze({port: 7034});

  inject(() => {
    return {
      broker: new Broker(conf).ensure()
    }
  });

  let c;

  before('get client', h => {
    return new Client(conf).ensure().then(function (client) {
      c = client;
    });
  });

  describe('injected', function () {

    it.cb('locks/unlocks', t => {

      c.lock('a', {}, function (err, unlock) {

        if (err) {
          return t.fail(err);
        }

        setTimeout(function () {
          unlock(t.done);
        }, 1500);

      });

    });

    it.cb('locks/unlocks', t => {

      c.lock('a', 1100, function (err, unlock, id) {

        if (err) {
          return t.fail(err);
        }

        setTimeout(function () {
          c.unlock('a', id, t.done);
        }, 1000);

      });

    });

    it.cb('locks/unlocks', t => {

      c.lock('a', {}, function (err, unlock, id) {

        if (err) {
          return t.fail(err);
        }

        setTimeout(function () {
          c.unlock('a', t.done);
        }, 1000);

      });
    });

  });

});
