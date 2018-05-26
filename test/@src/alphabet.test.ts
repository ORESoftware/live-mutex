'use strict';

import suman = require('suman');
const Test = suman.init(module);
const async = require('async');

// import {Client, Broker} from "../../dist";

import {Client} from "../../client";
import {Broker} from "../../broker";

////////////////////////////////////////////////////////

Test.create(['lmUtils', (b, assert, before, describe, it, path, fs, inject) => {
  
  const {lmUtils} = b.ioc;
  
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const a2z = alphabet.split('');
  assert.equal(a2z.length, 26, ' => Western alphabet is messed up.');
  
  const num = 100;
  
  const conf = Object.freeze({port: 7028});
  
  inject(j => {
    j.register('broker', new Broker(conf).ensure());
  });
  
  inject(j => {
    j.register('client', new Client(conf).ensure());
  });
  
  const p = path.resolve(__dirname + '/../fixtures/alphabet.test');
  
  // before.cb('clean up file', h => {
  //   fs.writeFile(p, '', h);
  // });
  
  const strm = fs.createWriteStream(p);
  
  describe('post', function (b) {
    
    const client = b.getInjectedValue('client') as Client;
    
    before.cb('yo', h => {
      
      async.each(a2z, function (val, cb) {
        
        client.lock('foo', function (err, v) {
          
          for (let i = 0; i < num; i++) {
            strm.write(val);
          }
          
          v.unlock(cb);
          
        });
        
      }, h.done);
      
    });
    
    it.cb('count characters => expect num*26', {timeout: 300}, t => {
      
      fs.readFile(p, function (err, data) {
        
        if (err) {
          return t.done(err);
        }
        
        assert.equal(String(data).trim().length, (26 * num));
        t.done();
        
      });
    });
    
    it.cb('10 chars of each, in order', {timeout: 300}, t => {
      
      const readable = fs.createReadStream(p);
      
      readable.once('error', t.fail);
      readable.once('end', t.done);
      
      readable.on('readable', function () {
        
        let index = 0;
        let chunk;
        while (null != (chunk = readable.read(1))) {
          
          const temp = (index - (index % num)) / num;
          assert.equal(String(chunk), alphabet[temp]);
          index++;
        }
        
      });
    });
    
  });
  
}]);