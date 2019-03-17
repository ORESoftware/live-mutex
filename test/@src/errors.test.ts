'use strict';

import suman = require('suman');
const Test = suman.init(module);
const async = require('async');
import * as lmx from 'live-mutex';
import {Client, Broker, LMXUnlockRequestError, LMXLockRequestError} from "live-mutex";

////////////////////////////////////////////////////////

Test.create((b, assert, before, describe, it, path, fs, inject, after) => {

  const {lmUtils} = b.ioc;

  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const a2z = alphabet.split('');
  assert.equal(a2z.length, 26, ' => Western alphabet is messed up.');

  const num = 100;
  const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
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
      const brokerConf = Object.assign({}, conf, {noListen: process.env.lmx_broker_no_listen === 'yes'});
    j.register('broker', new Broker(brokerConf).ensure().then(handleEvents));
  });

  inject(j => {
    j.register('client', new Client(conf).ensure().then(handleEvents));
  });


  describe('post', function (b) {

    const c = b.getInjectedValue('client') as Client;
    const broker = b.getInjectedValue('broker') as Broker;

    after.cb(h => {
      console.log('closing broker...');
      return broker.close(h);
    });


    it.cb('count characters => expect num*26', {timeout: 300}, t => {

      c.lock('zoo3838m', {}, (err,val) => {

        t.done();

      });

    });

  });

});