'use strict';

const path = require('path');
const async = require('async');
const lf = require('lockfile');
const a = Array.apply(null, {length: 100});
const file = path.resolve(process.env.HOME + '/.ore/lockfile/speed-test.lock');
const start = Date.now();

async.eachLimit(a, 10, function (val, cb) {

  const w = Math.ceil(Math.random() * 30);

  lf.lock(file, {wait: w, retries: 5000, stale: 50000}, function (err) {

    if (err) {
      return cb(err);
    }

    setTimeout(function () {
      lf.unlock(file, cb);
    }, Math.ceil(Math.random() * 5));

  });

}, function complete(err) {

  if (err) {
    throw err;
  }

  const diff = Date.now() - start;
  console.log(' => Time required for lockfile => ', diff);
  console.log(' => Lock/unlock cycles per millisecond => ', Number(a.length / diff).toFixed(3));
  process.exit(0);

});
