const path = require('path');
const async = require('async');
const lf = require('lockfile');

const a = Array.apply(null, {length: 1000});
const file = path.resolve(process.env.HOME + '/speed-test.lock');

const start = Date.now();

let i = 0;

async.each(a, function (val, cb) {

  const w = Math.ceil(Math.random() * 20);

  lf.lock(file, {wait: w, retries: 5000, stale: 500}, function (err) {
    if (err) {
      cb(err);
    }
    else {
      lf.unlock(file, cb);
    }
  });

}, function complete(err) {

  if (err) {
    throw err;
  }

  const diff = Date.now() - start;
  console.log(' => Time required for lockfile => ', diff);
  console.log(' => Lock/unlock cycles per millisecond => ', Number(a.length/diff).toFixed(3));
  process.exit(0);

});
