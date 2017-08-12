'use strict';

const async = require('async');
const lmUtils = require('live-mutex/utils');
const {Client} = require('live-mutex/client');
const conf = Object.freeze({port: 7003});

process.on('unhandledRejection', function (e) {
  console.error('unhandledRejection => ', e.stack || e);
});

const totalTime = 50000;
const intervalTimeSeed = 100;
const countSeed = 100;
let lockCount = 0;

let finishedQueueing = false;
setTimeout(function () {
  finishedQueueing = true;
}, totalTime);

///////////////////////////////////////////////////////////////////

lmUtils.launchBrokerInChildProcess(conf, function () {

  const client = new Client(conf);
  client.ensure().then(function () {

    const q = async.queue(function (task, cb) {
      task(cb);
    }, 500);  // max concurrency

    const start = Date.now();

    let onRandomInterval = function () {

      const randTime = Math.ceil(Math.random() * intervalTimeSeed);
      const randCount = Math.ceil(Math.random() * countSeed);

      if (finishedQueueing === false) {
        setTimeout(onRandomInterval, randTime);
      }

      for (let i = 0; i < randCount; i++) {
        q.push(function (cb) {
          client.lock('foo', function (err, unlock) {
            if (err) {
              cb(err);
            }
            else {
              lockCount++;
              unlock(cb);
            }
          });
        });
      }
    };

    onRandomInterval();

    q.drain = function complete(err) {

      if (err) {
        throw err;
      }

      if (finishedQueueing === false) {
        return onRandomInterval();
      }

      const diff = Date.now() - start;
      console.log(' => Time required for live-mutex => ', diff);
      console.log(' => Lock/unlock cycles per millisecond => ', Number(lockCount / diff).toFixed(3));
      process.exit(0);
    };

  });

});




