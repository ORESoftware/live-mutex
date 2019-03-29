'use strict';

import suman = require('suman');
const Test = suman.init(module);
const async = require('async');
import {Client} from "../../dist/client";
import {Broker} from "../../dist/broker";

////////////////////////////////////////////////////////

// @ts-ignore
Test.create(['lmUtils', (b, assert, before, describe, it, path, fs, inject, after) => {

  const {lmUtils} = b.ioc;

  const key = 'foo';
  const original = 'abcdefghijklmnopqrstuvwxyz';
  const alphabet = original.split('');
  const result = [];
  const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
  const conf = {port};
  
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
    const brokerConf = Object.assign({}, conf, {noListen: process.env.lmx_broker_no_listen === 'yes'});
    j.register('broker', new Broker(brokerConf).ensure().then(handleEvents));
  });

  describe('post', function (b) {

    const broker = b.getInjectedValue('broker') as Client;

    after.cb(h => {
      console.log('closing broker...');
      return broker.close(h);
    });

    const hasMoreLetters = function () {
      return alphabet.length > 0;
    };

    it.cb('all', {timeout: 50000}, t => {

      async.times(5, function (n, cb) {

        const c = new Client({port: conf.port, ttl: 5000, lockRequestTimeout: 100});
        handleEvents(c);

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