'use strict';
import suman = require('suman');
import {Client} from "../../client";

const Test = suman.init(module);

/////////////////////////////////////////////////////////

Test.create({mode: 'series'}, function (assert, before, it, LvMtxClient: Client, lmUtils, Promise) {

  const conf = Object.freeze({port: 7987});

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
      return c.lockp('z').then(function ({uuid}) {
        return c.unlockp('z', uuid);
      });
    });

  });

  it('yes', {timeout: 1500}, t => {

    const c = new LvMtxClient(conf);
    c.ensure().then(function () {
      return c.lock('z').then(function(){
        return c.unlock('z');
      });
    });

  });

  it.cb('yes', {timeout: 1500}, t => {

    LvMtxClient.create(conf).then(c => {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });

    }).catch(t);

  });

  it.cb('yes', {timeout: 1500}, t => {

    LvMtxClient.create(conf).then(c => {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    }).catch(t);

  });

  it.cb('yes', {timeout: 1500}, t => {

    LvMtxClient.create(conf).then(function (c) {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    }).catch(t);

  });

});