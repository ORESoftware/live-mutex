'use strict';

import suman = require('suman');
const {Test} = suman.init(module);
import {Client, Broker} from '../../dist';

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
  
  const conf = Object.freeze({port: 7038});
  
  inject(j => {
    j.register('broker', new Broker(conf).ensure());
  });
  
  inject(j => {
    j.register('client', new Client(conf).ensure());
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