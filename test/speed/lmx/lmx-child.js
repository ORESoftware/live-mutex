'use strict';

const path = require('path');
const {Client} = require('live-mutex/client');
const async = require('async');
const a = Array.apply(null, {length: 100});
const start = Date.now();

const lmxNum = process.env.lmx_num;

const c = new Client({
  keepLocksAfterDeath: true,
  keepLocksOnExit:true,
  lockRequestTimeout: 40000,
  udsPath: path.resolve(process.env.HOME + '/.ore/z.unix.lock')
});

let i = 0;

c.ensure().then(function () {

  async.eachLimit(a, 10, function (val, cb) {

    c.lock('foo', function (err, unlock) {

      if (err) {
        return cb(err);
      }

      setTimeout(function () {
        // console.error('unlocking ', lmxNum, i++);
        unlock(cb);
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

});


