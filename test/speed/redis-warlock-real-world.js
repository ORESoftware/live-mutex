'use strict';

const async = require('async');
const Warlock = require('node-redis-warlock');
const redis = require('redis');

// you must start redis on the default port (6379) for this test to work
// Establish a redis client and pass it to warlock
const client = redis.createClient();
const warlock = Warlock(client);

process.on('unhandledRejection', function (e) {
  console.error('unhandledRejection => ', e.stack || e);
});

const totalTime = 5000;
const intervalTimeSeed = 100;
const countSeed = 100;
let lockCount = 0;

let finishedQueueing = false;
setTimeout(function () {
  finishedQueueing = true;
}, totalTime);

///////////////////////////////////////////////////////////////////

const q = async.queue(function (task, cb) {
  task(cb);
}, 500);  // max concurrency

const start = Date.now();
const ttl = 3; // Lifetime of the lock
const maxAttempts = 400000; // Max number of times to try setting the lock before erroring

function firstEnsureKeyIsUnlocked(key, cb) {
  warlock.unlock(key, true, cb);
}

// Set a lock
const key = 'test-lock';

firstEnsureKeyIsUnlocked(key, function (err) {

  if (err) {
    throw err;
  }

  let onRandomInterval = function () {

    const randTime = Math.ceil(Math.random() * intervalTimeSeed);
    const randCount = Math.ceil(Math.random() * countSeed);

    if (finishedQueueing === false) {
      setTimeout(onRandomInterval, randTime);
    }

    for (let i = 0; i < randCount; i++) {
      q.push(function (cb) {
        const w = Math.ceil(Math.random() * 10);
        warlock.optimistic(key, ttl, maxAttempts, w, function (err, unlock) {
          if (err) {
            cb(err);
          }
          else {

            if (typeof unlock === 'function') {

              lockCount++;
              let randTime = Math.ceil(Math.random() * 10);
              setTimeout(function () {
                unlock(cb);
              }, randTime);

            }
            else {
              // Could not acquire lock ?
              throw 'Could not acquire lock';
            }
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
    console.log(' => Time required for lockfile => ', diff);
    console.log(' => Lock/unlock cycles per millisecond => ', Number(lockCount / diff).toFixed(3));
    process.exit(0);
  };

});





