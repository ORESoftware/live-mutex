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
    c.acquireReadLock('foo', (err, release) => {

      if (err) return cb(err);

      release((err, val) => {

        if (err) return cb(err);

        c.acquireWriteLock('foo', (err, release) => {

          if (err) return cb(err);

          release((err, val) => {

            if (err) return cb(err);

            console.log('all done:', err, Object.assign({}, val));
            console.log('all done after:', Date.now() - start);

            cb(null);

          });

        });

      });

    });
  };

  const firstWrite = function (cb) {
    c.acquireWriteLock('foo', (err, release) => {

      if (err) return cb(err);

      release((err, val) => {

        if (err) return cb(err);

        c.acquireReadLock('foo', (err, release) => {

          if (err) return cb(err);

          release((err, val) => {

            if (err) return cb(err);

            console.log('all done:', err, Object.assign({}, val));
            console.log('all done after:', Date.now() - start);

            cb(null);

          });

        });

      });

    });
  };

  async.timesLimit(100, 3, function (n, cb) {

    console.log('doing it:', n);

    if (Math.random() > .5) {
      firstRead(cb);
    }
    else {
      firstWrite(cb);
    }

  }, function (err) {

    if (err) throw err;

    console.log('all done I guess.');

  });

})
.catch(e => {
  console.error(e);
  process.exit(1);
});


