'use strict';

// note: this should run in less than 100 ms, even with logging

const async = require('async');
const {lmUtils} = require('live-mutex');
const {Client} = require('live-mutex');

const conf = Object.freeze({port: 7003});

lmUtils.launchBrokerInChildProcess(conf, function () {

  const client = new Client(conf);

  client.ensure().then(function () {

    const a = Array.apply(null, {length: 1000});
    const start = Date.now();

    let i = 0;

    async.each(a, function (val, cb) {

      client.lock('foo', function (err, unlock) {
        if (err) {
          return cb(err);
        }

        console.log('unlocking...' + i++);
        unlock(cb);

      });

    }, function complete(err) {

      if (err) {
        throw err;
      }

      console.log(' => Time required for live-mutex => ', Date.now() - start);
      process.exit(0);
    });

  });

});

