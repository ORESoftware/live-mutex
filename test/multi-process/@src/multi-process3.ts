'use strict';
import suman = require('suman');
const Test = suman.init(module);

////////////////////////////////////////////////

Test.create(['Client', 'Broker', 'lmUtils', function (b, assert, before, describe, it, inject, $core, $deps) {
  
  const {Client, Broker, lmUtils} = b.ioc;
  const {child_process: cp, fs, path} = $core;
  const {async, chalk: colors} = $deps;
  
  const multi_process_port = 3018;
  // start broker MANUALLY in a different process
  
  process.setMaxListeners(1000);
  process.stderr.setMaxListeners(1000);
  process.stdout.setMaxListeners(1000);
  
  it.cb('all', {timeout: 50000}, t => {
    
    const p = path.resolve(__dirname + '/../../fixtures/run-multiple-clients-in-sep-process.js');
    
    async.times(15, function (n, cb) {
      
      const k = cp.spawn('node', [p], {
        env: Object.assign({}, process.env, {
          multi_process_port
        })
      });
      
      k.stderr.setEncoding('utf8');
      k.stderr.pipe(process.stderr);
      
      k.once('exit', function (code) {
        
        cb(code, {code});
        
      });
      
    }, function (err, result) {
      
      console.log('arguments', arguments);
      
      if (result) {
        console.log(result);
      }
      
      t.done(err);
      
    });
    
  });
  
}]);










