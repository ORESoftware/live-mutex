'use strict';

import suman = require('suman');
const {Test} = suman.init(module);
import {Client, Broker} from '../../dist/main';

///////////////////////////////////////////////////////////

Test.create(['Promise', function (b, assert, describe, inject, it, $deps, $core) {
  
  const {Promise} = b.ioc;
  const {lodash: _, async, chalk: colors} = $deps;
  
  const arrays = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 1, 2, 111, 2, 2, 21, 1, 11, 1, 111, 1, 111, 1, 2, 2, 2, 2, 1, 2, 21, 11, 11111, 111, 1, 11, 1, 1, 1, 1, 1, 1, 1],
    ['a', 'a', 'a1', 'a2', 'a2', 'a2', 'a1', 'a2'],
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  ];

  const handleEvents = function (v) {

    v.emitter.on('warning', w => {
      console.error('warning:', w);
    });

    v.emitter.on('error', w => {
      console.error('error:', w);
    });

    return v;
  };


  console.log('suman child id:',process.env.SUMAN_CHILD_ID);
  const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
  const conf = Object.freeze({port});
  
  inject(j => {
    const brokerConf = Object.assign({}, conf, {noListen: process.env.lmx_broker_no_listen === 'yes'});
    j.register('broker', new Broker(brokerConf).ensure().then(handleEvents));
  });
  
  inject(j => {
    j.register('client', new Client(conf).ensure().then(handleEvents));
  });
  
  describe('inject', b => {
    
    const c = b.getInjectedValue('client') as Client;
    
    arrays.forEach(a => {
      
      describe.delay('resumes', function (b) {
        
        async.map(a, function (val, cb) {
          
          cb(null, t => {
            
            c.lock(String(val), function (err, v) {

              if (err) {
                return t.fail(err);
              }
              
              setTimeout(function () {
                c.unlock(String(val), {force: false, _uuid: v.lockUuid}, t.done);
              }, 100);
              
            });
            
          });
          
        }, function (err, results) {
          
          if (err) {
            throw err;
          }
          
          b.resume(results);
          
        });
        
        describe.parallel('handles results', b => {
          
          const fns = b.getResumeValue();
          
          fns.forEach(fn => {
            
            it.cb('locks/unlocks', fn);
            
          });
          
        });
        
      });
      
    });
    
  });
  
}]);