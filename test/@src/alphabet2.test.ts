'use strict';

import suman = require('suman');
const Test = suman.init(module);
const async = require('async');
import {Client} from "../../client";
import {Broker} from "../../broker";

////////////////////////////////////////////////////////

Test.create(['lmUtils', (b, assert, before, describe, it, path, fs, inject, after) => {

  const {lmUtils} = b.ioc;

  const key = 'foo';
  const original = 'abcdefghijklmnopqrstuvwxyz';
  const alphabet = original.split('');
  const result = [];

  const conf = Object.freeze({port: 7029});

  inject(j => {
    j.register('broker', new Broker(conf).ensure());
  });

  describe('post', function (b) {

    const broker = b.getInjectedValue('broker') as Client;

    after(h => {
      return broker.close();
    });

    const hasMoreLetters = function () {
      return alphabet.length > 0;
    };

    it.cb('all', {timeout: 50000}, t => {

      async.times(5, function (n, cb) {

        const c = new Client({port: conf.port, ttl: 5000, lockRequestTimeout: 100});

        async.whilst(hasMoreLetters, function (cb) {

          c.ensure(function (err) {

            if (err) {
              return cb(err);
            }

            c.lock(key, function (err, unlock) {

              if (err) {
                return cb(null);
              }

              const v = alphabet.shift();
              v && result.push(v);

              const rand = Math.random() * 100;
              setTimeout(function () {
                unlock(cb);
              }, rand);

            });

          });

        }, cb);

      }, function (err) {

        if (err) {
          return t.done(err);
        }

        if (result.join('') === original) {
          console.log('result:', result);
          console.log('original:', original);
          return t.done();
        }

        t.done(
          new Error('original different than result' + result)
        );

      });

    });

  });

}]);