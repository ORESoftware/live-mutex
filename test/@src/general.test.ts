'use strict';

import * as suman from 'suman';

const {Test} = suman.init(module);
import async = require('async');
import {Broker, Client} from '../../dist/main';

//@ts-ignore
Test.create(['Promise', function (b, it, inject, describe, before, $deps, path) {
  
  const conf = Object.freeze({udsPath: path.resolve(process.env.HOME + '/suman.test2.unix.sock')});
  
  const handleEvents = function (v) {
    
    v.emitter.on('warning', w => {
      console.error('warning:', w);
    });
    
    v.emitter.on('error', w => {
      console.error('error:', w);
    });
    
    return v;
  };
  
  inject(() => {
    // const brokerConf = Object.assign({}, conf, {noListen: process.env.lmx_broker_no_listen === 'yes'});
    return {
      broker: new Broker(conf).ensure().then(handleEvents)
    }
  });
  
  
  before('get client', h => {
    return new Client(conf).ensure().then(function (client) {
      h.supply.client = handleEvents(client);
    });
  });
  
  describe('injected', function (b) {
    
    it.cb('locks/unlocks', {timeout: 7011}, t => {
      
      const c = t.supply.client;
      
      async.timesLimit(1000, 20, function (n, cb) {
        
        const r = Math.ceil(Math.random() * 5);
        
        c.lock('a', (err, v) => {
          
          if (err) {
            return cb(err);
          }
          
          setTimeout(function () {
            v.unlock(cb);
          }, r);
          
        });
        
      }, t);
      
      
    });
    
    
  });
  
}]);
