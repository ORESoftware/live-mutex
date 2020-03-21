'use strict';

// note: this should run in less than 100 ms, even with logging

const async = require('async');
const {lmUtils} = require('live-mutex');
const {Client} = require('live-mutex');

const conf = Object.freeze({port: 7003});

lmUtils.launchBrokerInChildProcess(conf, function () {

  const client = new Client(conf);

  client.ensure().then(function () {

    const locksRequestd = 100000;
    const a = Array.apply(null, {length: locksRequestd});
    const start = Date.now();

    let i = 0;
    let lockCount = 0;

    async.eachLimit(a, 1800, function (val, cb) {

      client.lock('foo', function (err, unlock) {
        if (err) {
          return cb(err);
        }
        
        lockCount++;
        
        if(lockCount > 1){
          throw 'too many lockholders.'
        }

        console.log('unlocking...' + i++);
        unlock(err => {
          lockCount--;
          cb();
        });

      });

    }, function complete(err) {

      if (err) {
        throw err;
      }

      const elapsed = Date.now() - start;
      console.log(' => Time required for live-mutex => ', locksRequestd/elapsed);
      console.log(' => Lock cycles per millisecond => ', elapsed);
      process.exit(0);
    });

  });

});

