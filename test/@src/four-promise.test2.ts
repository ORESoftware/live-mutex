'use strict';

import suman = require('suman');
const Test = suman.init(module);

/////////////////////////////////////////////////////////

Test.create({mode: 'series'}, ['LvMtxClient', 'lmUtils', 'Promise', function (b, assert, before, it,) {

  const {LvMtxClient, lmUtils, Promise} = b.ioc;
  const conf = Object.freeze({port: 7988});
  console.log('four promise tests');

  before('promise', function () {

    return lmUtils.conditionallyLaunchSocketServer(conf)
    .then(function (data) {
      return Promise.delay(30);
    }, function (err) {
      if (err) {
        console.error(err.stack);
      }
      else {
        throw new Error('no error passed to reject handler');
      }
    });
  });

  it('yes', {timeout: 1500}, t => {

    return LvMtxClient.create(conf).then(c => {
      return c.lockp('z').then(function ({lockUuid}) {
        return c.unlockp('z', lockUuid);
      });
    });

  });

  it('yes', {timeout: 1500}, t => {

    const c = new LvMtxClient(conf);
    return c.ensure().then(function () {
      return c.lockp('z').then(function () {
        return c.unlockp('z', true);
      });
    });

  });

  it('yes', {timeout: 1500}, t => {
    return LvMtxClient.create(conf).then(c => {
      return c.lockp('z').then(function () {
        return c.unlockp('z');
      });
    });
  });

  it('yes', {timeout: 1500}, t => {
    return LvMtxClient.create(conf).then(c => {
      return c.lockp('z').then(function () {
        return c.unlockp('z');
      });
    });
  });

  it('yes', {timeout: 1500}, t => {

    return LvMtxClient.create(conf).then(c => {
      return c.lockp('z').then(() => {
        return c.unlockp('z');
      });
    });
  });

}]);