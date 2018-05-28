'use strict';

const async = require('async');
const lmUtils = require('live-mutex/utils');
const {Client} = require('live-mutex/client');
const conf = Object.freeze({port: 7003});

process.on('unhandledRejection', function (e) {
  console.error('unhandledRejection => ', e.stack || e);
});

///////////////////////////////////////////////////////////////////

lmUtils.launchBrokerInChildProcess(conf, function () {
  
  const client = new Client(conf);
  
  client.ensure().then(function () {
    
    const a = Array.apply(null, {length: 1000});
    const start = Date.now();
    
    var i = 0;
    async.eachLimit(a, 50, function (val, cb) {
      
      client.lock('foo', function (err, {unlock}) {
        
        if (err) {
          return cb(err);
        }
        
        // console.log('unlocking...' + i++);
        // client.unlock('foo',cb);
        
        unlock(cb);
        
      });
      
    }, function complete(err) {
      
      if (err) {
        throw err;
      }
      
      const diff = Date.now() - start;
      console.log(' => Time required for live-mutex => ', diff);
      console.log(' => Lock/unlock cycles per millisecond => ', Number(a.length / diff).toFixed(3));
      process.exit(0);
    });
    
  });
  
});




