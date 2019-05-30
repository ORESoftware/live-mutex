'use strict';

import util = require('util');
process.on('uncaughtException', e => {
  console.log(util.inspect(e));
});

import suman from 'suman';
const Test = suman.init(module);

import * as async from 'async';

// import the other way, just to be sure
import {Client, Broker, lmUtils} from 'live-mutex';

/////////////////////////////////////////////////////////////////////

Test.create([function (b, inject, describe, before, it, $deps, $core) {
  
  const {fs, path, assert} = $core;
  const {chalk: colors, lodash: _} = $deps;
  
  console.log('suman child id:',process.env.SUMAN_CHILD_ID);
  const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
  const conf = Object.freeze({port});
  
  inject(j => {
    const brokerConf = Object.assign({}, conf, {noListen: process.env.lmx_broker_no_listen === 'yes'});
    j.register('broker', new Broker(brokerConf).ensure());
  });
  
  inject(j => {
    j.register('client', new Client(conf).ensure());
  });
  
  const f = require.resolve('../fixtures/corruptible.txt');
  
  before.cb('remove file', function (t) {
    fs.writeFile(f, '', t);
  });
  
  describe('inject', b => {
    
    const c = <Client> b.getInjectedValue('client');
    const broker = <Broker> b.getInjectedValue('broker');
    
    // c.emitter.on('warning', w => {
    //
    // });
    //
    // broker.emitter.on('warning', w => {
    //
    // });
  
  
    it.cb('Locks before new connection', {timeout: 10000}, t => {
      
      let i = 0;
      
      async.times(5, (n, cb) => {
        
        c.lock('foo' + n, (err, val) => {
          console.log({err,val});
          
          if(err){
            return cb(null);
          }
          
          t.unlock();
          cb(null);
        });
        
      }, (err,val) => {
        
        t.done();
        
      });
      
      
      c.createNewConnection();
      
    });
  
  
    it.cb('Locks after new connection', {timeout: 10000}, t => {
    
      async.times(5, (n, cb) => {
      
        c.lock('foo' + n, (err,val) => {
          console.log({err,val});
          cb(null);
        });
        
      }, t.done);
    
      
    });
    
  });
  
}]);