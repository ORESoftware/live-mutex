'use strict';

import suman = require('suman');
const Test = suman.init(module);
import {Client} from '../../dist';

/////////////////////////////////////////////////////

Test.create({mode: 'parallel'}, ['lmUtils', function (b, assert, before, it) {
  
  const {lmUtils} = b.ioc;

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

  before('promise', function () {
    return lmUtils.conditionallyLaunchSocketServerp(conf);
  });
  
  it.cb('yes 1', {timeout: 30000}, t => {
    const client = new Client(conf, (err, c) => {
      c.lock('z', function (err,v) {
        if (err) return t(err);
        c.unlock('z', v.id,t);
      });
    });
  });
  
  it.cb('yes 2', {timeout: 30000}, t => {

    new Client(conf, function (err, c) {

      if (err) {
        return t(err);
      }

      c.lock('z', {}, function (err,unlock) {

        if (err) return t(err);
        unlock(t.done);
      });

      c.lock('z', function (err,unlock) {
        if (err) return t(err);
        unlock(t.done);
      });

    });
  });
  
  it.cb('yes 3', {timeout: 30000}, t => {
    const client = new Client(conf);
    return client.ensure(function (err, c) {
      if (err) return t(err);
      c.lock('z', function (err, v) {
        if (err) return t(err);
        c.unlock('z',v.id, t);
      });
    });
  });
  
  it.cb('yes 4', {timeout: 30000}, t => {
    const client = new Client(conf);
    return client.ensure().then(function (c) {
      c.lock('z', function (err, v) {
        if (err) return t(err);
        c.unlock('z', v.id,t.done);
      });
    });
  });

  it('yes 5', {timeout: 30000}, t => {
    const client = new Client(conf);
    return client.ensure().then(function (c) {
      return c.lockp('z').then(function ({unlock}) {
        return c.run(unlock);
      });
    });
  });
  
}]);