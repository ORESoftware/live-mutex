'use strict';

import suman = require('suman');
const Test = suman.init(module);

/////////////////////////////////////////////////////////

Test.create({mode: 'series'}, ['Client', 'lmUtils', 'Promise', function (b, assert, before, it) {

  const {Client, lmUtils, Promise} = b.ioc;

  console.log('suman child id:',process.env.SUMAN_CHILD_ID);

  const port = 7000 + parseInt(process.env.SUMAN_CHILD_ID || '1');
  const conf = Object.freeze({port});

  before(function () {
    return lmUtils.conditionallyLaunchSocketServerp(conf)
    .then(x => Promise.delay(300));
  });

  it.cb('yes', {timeout: 1500}, t => {

    const c = Client.create(conf);
    c.ensure((err, c) => {
      if (err) {
        return t.fail(err);
      }
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

  it.skip.cb('yes', {timeout: 1500}, t => {

    Client.create(conf).ensure().then(c => {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });

  });


  it.skip.cb('yes', {timeout: 3500}, t => {
    return Client.create(conf).ensure().then(c => {
      return c.lockp('z').then(function ({unlock}) {
        if(unlock.acquired !== true){
          return Promise.reject('acquired was not true.');
        }
        unlock(t);
      });
    });
  });

  it.skip('yes', {timeout: 3500}, t => {
    return Client.create(conf).ensure().then(c => {
      return c.lockp('z').then(({unlock, acquired}) => {
        if(acquired !== true){
          return Promise.reject('acquired was not true.');
        }
        return c.runUnlock(unlock);
      });
    });
  });

  it.skip('yes', {timeout: 3500}, t => {
    return Client.create(conf).ensure().then(c => {
      return c.lockp('z').then(function (unlock) {
        if(unlock.acquired !== true){
          return Promise.reject('acquired was not true.');
        }
        return c.execUnlock(unlock);
      });
    });
  });

  it.skip('yes', {timeout: 1500}, t => {

    return Client.create(conf).ensure().then((c) => {
      return c.lockp('z').then(() => {
        return c.unlockp('z');
      });
    });

  });

}]);