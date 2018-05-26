'use strict';

import suman = require('suman');
const Test = suman.init(module);
import {LvMtxClient} from "../../dist";
import {lmUtils} from "../../dist";

/////////////////////////////////////////////////////////

Test.create({mode: 'series'}, ['Promise', function (b, assert, before, it,) {
  
  const {Promise} = b.ioc;
  const conf = Object.freeze({port: 7988});
  
  before('promise', function () {
    return lmUtils.conditionallyLaunchSocketServerp(conf)
    .then(function (data) {
      return Promise.delay(300);
    });
  });
  
  it('yes', {timeout: 1500}, t => {
    return LvMtxClient.create(conf).ensure().then(c => {
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
    return LvMtxClient.create(conf).ensure().then(c => {
      return c.lockp('z').then(function () {
        return c.unlockp('z');
      });
    });
  });
  
  it('yes', {timeout: 1500}, t => {
    return LvMtxClient.create(conf).ensure().then(c => {
      return c.lockp('z').then(function () {
        return c.unlockp('z');
      });
    });
  });
  
  it('yes', {timeout: 1500}, t => {
    return LvMtxClient.create(conf).ensure().then(c => {
      return c.lockp('z').then(() => {
        return c.unlockp('z');
      });
    });
  });
  
}]);