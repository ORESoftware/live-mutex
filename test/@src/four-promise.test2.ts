'use strict';

import suman = require('suman');
const Test = suman.init(module);
import {LvMtxClient} from "../../dist";
import {lmUtils} from "../../dist";

/////////////////////////////////////////////////////////

Test.create({mode: 'series'}, ['Promise', function (b, assert, before, it,) {
  
  const {Promise} = b.ioc;

  console.log('suman child id:',process.env.SUMAN_CHILD_ID);
  const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
  const conf = Object.freeze({port});
  
  before('promise', function () {
    const brokerConf = Object.assign({}, conf, {noListen: process.env.lmx_broker_no_listen === 'yes'});
    return lmUtils.conditionallyLaunchSocketServerp(brokerConf)
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