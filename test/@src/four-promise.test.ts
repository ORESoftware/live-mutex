'use strict';

import suman = require('suman');

const Test = suman.init(module);

/////////////////////////////////////////////////////////

Test.create({mode: 'series'}, ['Client', 'lmUtils', 'Promise', function (b, assert, before, it) {
  
  const {Client, lmUtils, Promise} = b.ioc;
  const conf = Object.freeze({port: 7987});
  
  before(function () {
    return lmUtils.conditionallyLaunchSocketServer(conf)
    .then(function (data) {
        return Promise.delay(30);
      },
      function (err) {
        if (err) {
          console.error(err.stack);
        }
        else {
          throw new Error('no error passed to reject handler');
        }
      });
  });
  
  it.cb('yes', {timeout: 1500}, t => {
    
    const c = Client.create(conf);
    c.ensure((err, c) => {
      if (err) return t.fail(err);
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });
    
  });
  
  it('yes', {timeout: 1500}, t => {
    
    const c = new Client(conf);
    return c.ensure().then(function () {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });
    
  });
  
  it.cb('yes', {timeout: 1500}, t => {
    
    Client.create(conf).ensure().then(c => {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    }).catch(t);
    
  });
  
  it.cb('yes', {timeout: 1500}, t => {
    
    return Client.create(conf).ensure().then(c => {
      return c.lockp('z').then(function ({unlock}) {
        return unlock(t);
      });
    });
  });
  
  it('yes', {timeout: 1500}, t => {
    
    return Client.create(conf).ensure().then((c) => {
      return c.lockp('z').then(() => {
        return c.unlockp('z');
      });
    });
    
  });
  
}]);