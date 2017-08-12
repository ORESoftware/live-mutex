'use strict';

const async = require('async');
const lf = require('lockfile');
const path = require('path');
const file = path.resolve(process.env.HOME + '/speed-test.lock');

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

const q = async.queue(function (task, cb) {
  task(cb);
}, 500); // max concurrency

const start = Date.now();

let onRandomInterval = function () {

  const randTime = Math.ceil(Math.random() * intervalTimeSeed);
  const randCount = Math.ceil(Math.random() * countSeed);

  if (finishedQueueing === false) {
    setTimeout(onRandomInterval, randTime);
  }

  for (let i = 0; i < randCount; i++) {
    q.push(function (cb) {
      const w = Math.ceil(Math.random() * 20);
      lf.lock(file, {wait: w, retries: 5000, stale: 500}, function (err) {
        if (err) {
          cb(err);
        }
        else {
          lockCount++;
          let randTime = Math.ceil(Math.random() * 10);
          setTimeout(function () {
            lf.unlock(file, cb);
          }, randTime);
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








