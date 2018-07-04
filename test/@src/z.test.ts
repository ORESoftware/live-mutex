'use strict';

import suman = require('suman');
const Test = suman.init(module);
import {Client} from '../../dist';

/////////////////////////////////////////////////////

Test.create({mode: 'parallel'}, ['lmUtils', function (b, assert, before, it) {
  
  const {lmUtils} = b.ioc;
  const conf = Object.freeze({port: 7888});
  
  before('promise', function () {
    return lmUtils.conditionallyLaunchSocketServerp(conf);
  });
  
  it.cb('yes 1', {timeout: 30000}, t => {
    const client = new Client(conf, (err, c) => {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });
  });
  
  it.cb('yes 2', {timeout: 30000}, t => {
    new Client(conf, function (err, c) {
      if (err) return t(err);
      this.lock('z', function (err,unlock) {
        if (err) return t(err);
        unlock(t.done);
      });
    });
  });
  
  it.cb('yes 3', {timeout: 30000}, t => {
    const client = new Client(conf);
    return client.ensure(function (err, c) {
      if (err) return t(err);
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });
  });
  
  it.cb('yes 4', {timeout: 30000}, t => {
    const client = new Client(conf);
    return client.ensure().then(function (c) {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t.done);
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