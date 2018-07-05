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

  const acquireWriteLock = function () {
    return c.acquireWriteLockp('foo').then(release => {
      console.log('acquired write lock', release);
      return c.run(release).then(v => {
        console.log('all done writing/released write lock:', Object.assign({}, val));
      })
    });
  };

  const acquireReadLock = function () {
    return c.acquireReadLockp('foo').then(release => {
      console.log('acquired read lock', release);
      return c.run(release).then(v => {
        console.log('all done reading/release read lock:', Object.assign({}, val));
      });
    });
  };

  const x = function () {
    if (Math.random() > .2) {
      return acquireReadLock();
    }
    return acquireWriteLock();
  };

  let p = Promise.resolve(null);

  for (let v = 0; v < 100; v++) {
    p = p.then(function () {
      console.log('running.');
      return Promise.all(new Array(10).fill(null).map(v => x()))
    });
  }

  return p;

})
.then(function () {
  console.log('all done I guess.');
})
.catch(e => {
  console.error('BIG EXIT FUCK ME',e);
  process.exit(1);
});


