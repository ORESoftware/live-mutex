'use strict';

import suman = require('suman');
const Test = suman.init(module);
const async = require('async');
import {Client} from "../../dist/client";
import {Broker} from "../../dist/broker";

////////////////////////////////////////////////////////

Test.create(['lmUtils', (b, assert, before, describe, it, path, fs, inject, after) => {

  const {lmUtils} = b.ioc;

  const num = 100;

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

  inject(j => {
    j.register('broker', new Broker(conf).ensure().then(handleEvents));
  });

  inject(j => {
    j.register('client', new Client(conf).ensure().then(handleEvents));
  });

  describe('post', b => {

    const c = b.getInjectedValue('client') as Client;
    const broker = b.getInjectedValue('broker') as Broker;

    c.emitter.on('warning', (...args) => console.error(...args));
    broker.emitter.on('warning', (...args) => console.error(...args));

    after.cb(h => {
      console.log('closing broker...');
      return broker.close(h);
    });

    let count = {
      val: 0
    };

    let max = 4;

    before.cb(h => {

      async.timesLimit(100, 13, function (n, cb) {

        c.lock('foo', {max}, (err, v) => {

          if (err) {
            return cb(err);
          }

          count.val++;
          console.log('here is the count:', count.val, 'max:', max);

          if (count.val > max) {
            return cb(new Error('count is greather than max.'));
          }

          setTimeout(function () {

            if (count.val > max) {
              return cb(new Error('count is greather than max.'));
            }

            count.val--;

            c.unlock('foo', v.id, cb);

          }, Math.ceil(Math.random() * 10));

        });

      }, h);

    });

    it.cb('final result is 0', {timeout: 300}, t => {
      t.finally(function () {
        t.assert(count.val === 0);
      });
    });

  });

}]);