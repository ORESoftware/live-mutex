#!/usr/bin/env node
'use strict';

const {Client, Broker} = require('live-mutex');
const async = require('async');

Promise.all([
  new Broker().ensure(),
  new Client().connect()
])
.then(function ([b, c]) {

  b.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error(...arguments);
    }
  });

  c.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error(...arguments);
    }
  });

  let readers = 0;
  let writers = 0;

  const start = Date.now();

  const firstRead = function (cb) {
    c.lock('foo', (err, release) => {
      err ? cb(err) : release(cb);
    });
  };

  const firstWrite = function (cb) {
    c.lock('foo', (err, release) => {
       err ? cb(err) : release(cb);
    });
  };

  async.timesLimit(1000, 30, function (n, cb) {

    // console.log('doing it:', n);

    if (Math.random() > .5) {
      firstRead(cb);
    }
    else {
      firstWrite(cb);
    }

  }, function (err) {

    if (err) throw err;

    console.log('all done I guess:', Date.now() - start);

  });

})
.catch(e => {
  console.error(e);
  process.exit(1);
});


