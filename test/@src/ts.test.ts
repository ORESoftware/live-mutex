'use strict';
import suman from 'suman';
const Test = suman.init(module);

// import the other way, just to be sure
import {Client, Broker, lmUtils} from 'live-mutex';

/////////////////////////////////////////////////////////////////////

Test.create([function (b, inject, describe, before, it, $deps, $core) {
  
  const {fs, path, assert} = $core;
  const {chalk: colors, async, lodash: _} = $deps;

  console.log('suman child id:',process.env.SUMAN_CHILD_ID);
  const port = 7000 + parseInt(process.env.SUMAN_CHILD_ID || '1');
  const conf = Object.freeze({port});
  
  inject(j => {
    j.register('broker', new Broker(conf).ensure());
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
    
    const lockWriteRelease = function (val, cb) {
      
      c.lock('a', function (err, {unlock}) {
        
        if (err) {
          return cb(err);
        }
        
        fs.appendFile(f, '\n' + String(val), function (err) {
          err ? cb(err) : unlock(cb);
        });
        
      });
    };
    
    before.cb('write like crazy', {timeout: 30000}, t => {
      
      const a = Array.apply(null, {length: 20}).map((item, index) => index);
      async.each(a, lockWriteRelease, t.done);
      
    });
    
    it.cb('ensure that file still has the same stuff in it!', {timeout: 30000}, t => {
      
      fs.readFile(f, function (err, data) {
        if (err) {
          return t.fail(err);
        }
        
        const arr = String(data).split('\n').filter(function (line) {
          return String(line).trim().length > 0;
        });
        
        arr.forEach(function (item, index) {
          assert.equal(String(item), String(index), 'item and index are not equal');
        });
        
        t.done();
        
      });
      
    });
    
  });
  
}]);