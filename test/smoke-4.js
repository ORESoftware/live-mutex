#!/usr/bin/env node
'use strict';

const {RWLockWritePrefClient, Broker} = require('live-mutex');
const async = require('async');

Promise.all([
  new Broker().ensure(),
  new RWLockWritePrefClient().connect()
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
    c.acquireReadLock('foo', (err, release) => {

      if (err) {
        return cb(err);
      }

      release(cb);


    });
  };

  const firstWrite = function (cb) {
    c.acquireWriteLock('foo', (err, release) => {

      if (err) {
        return cb(err);
      }

      release(cb);

    });
  };

  async.timesLimit(10000, 2, function (n, cb) {

    console.log('doing it:', n);

    const r = Math.ceil(Math.random() * 20);

    setTimeout(() => {

      if (Math.random() > .5) {
        firstRead(cb);
      }
      else {
        firstWrite(cb);
      }

    }, r);


  }, function (err) {

    if (err) throw err;

    console.log('all done I guess:', Date.now() - start);

  });

})
.catch(e => {
  console.error(e);
  process.exit(1);
});


