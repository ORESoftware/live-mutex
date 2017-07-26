'use strict';

import suman = require('suman');
const Test = suman.init(module);
const colors = require('colors/safe');

Test.create(function (it, Broker, Client, inject, describe, before) {

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

        console.log('\n', colors.yellow(' ONE lock acquired!!! => '), '\n');

        setTimeout(function () {
          unlock(function (err) {
            if (err) {
              return t.fail(err);
            }
            else {
              console.log(colors.yellow(' ONE lock released!!! => '));
              t.done();
            }

          });
        }, 1500);

      });

    });

    it.cb('locks/unlocks', t => {

      c.lock('a', 1100, function (err, unlock, id) {

        if (err) {
          return t.fail(err);
        }

        console.log('\n', colors.blue(' TWO lock acquired!!! => '), '\n', id);

        setTimeout(function () {

          c.unlock('a', id, function (err) {
            if (err) {
              return t.fail(err);
            }
            else {
              console.log(colors.blue(' TWO lock released!!! => '));
              t.done();
            }

          });

        }, 1000);

      });

    });

    it.cb('locks/unlocks', t => {

      c.lock('a', {}, function (err, unlock, id) {

        if (err) {
          return t.fail(err);
        }

        console.log('\n', colors.green(' THREE lock acquired!!! => '), '\n', id);

        setTimeout(function () {
          c.unlock('a', function (err) {
            if (err) {
              t.fail(err);
            }
            else {
              console.log(colors.green(' THREE lock released!!! => '));
              t.done();
            }

          });
        }, 1000);

      });
    });

  });

});
