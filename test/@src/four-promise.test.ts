'use strict';

import suman = require('suman');
const Test = suman.init(module);
import {Client, lmUtils, Broker} from 'live-mutex';

/////////////////////////////////////////////////////////

Test.create({mode: 'series'}, ['Client', 'lmUtils', 'Promise', function (b, assert) {

  const {Promise} = b.ioc;
  const {before, it} = b.getHooks();

  console.log('suman child id:', process.env.SUMAN_CHILD_ID);

  const port = 7000 + parseInt(process.env.SUMAN_CHILD_ID || '1');
  const conf = Object.freeze({port});

  before(function () {
    return new Broker(conf).start();
  });

  it.skip.cb('yes - 1', {timeout: 3900}, t => {

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

  it.skip('yes - 2', {timeout: 3900}, t => {
    const c = new Client(conf);
    return c.ensure().then(function () {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });
  });

  it.cb('yes - 3', {timeout: 3900}, t => {
    const c = Client.create(conf);
    c.ensure().then(c => {
      t.log('client is ensured.');
      c.lock('z', function (err) {
        t.log('acquired lock on z.');
        if (err) return t(err);
        c.unlock('z', t);
      });
    });
  });

  it.cb('yes - 4', {timeout: 3500}, t => {
    return Client.create(conf).ensure().then(c => {
      return c.lockp('z').then(function ({unlock}) {
        if (unlock.acquired !== true) {
          return Promise.reject('acquired was not true.');
        }
        unlock(t);
      });
    });
  });

  it('yes - 5', {timeout: 3500}, t => {

    const c = Client.create(conf);

    c.ensure().then(c => {
      return c.lockp('z').then(({unlock, acquired}) => {
        if (acquired !== true) {
          return Promise.reject('acquired was not true.');
        }
        return c.runUnlock(unlock);
      });
    });
  });

  it('yes - 6', {timeout: 3500}, t => {
    return Client.create(conf).ensure().then(c => {
      return c.lockp('z').then(function (unlock) {
        if (unlock.acquired !== true) {
          return Promise.reject('acquired was not true.');
        }
        return c.execUnlock(unlock);
      });
    });
  });

  it('yes - 7', {timeout: 3900}, t => {

    return Client.create(conf).ensure().then((c) => {
      return c.lockp('z').then(() => {
        return c.unlockp('z');
      });
    });

  });

}]);