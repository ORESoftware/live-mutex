#!/usr/bin/env node
'use strict';

const {Client, Broker} = require('live-mutex');

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

  c.acquireReadLock('foo', (err, release) => {

    if (err) throw err;

    release((err, val) => {

      if (err) throw err;

      c.acquireWriteLock('foo', (err, release) => {

        if (err) throw err;

        release((err, val) => {

          if (err) throw err;

          console.log('all done');
          console.log('all done after:', Date.now() - start);

        });

      });

    });

  });

})
.catch(e => {
  console.error(e);
  process.exit(1);
});


