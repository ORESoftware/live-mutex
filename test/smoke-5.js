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

  const max = 22;

  const firstRead = function (cb) {
    c.lock('foo', {max},(err, release) => {
      err ? cb(err) : release(cb);
    });
  };

  const firstWrite = function (cb) {
    c.lock('foo', {max},(err, release) => {
       err ? cb(err) : release(cb);
    });
  };

  async.timesLimit(1000, 20, function (n, cb) {

    // console.log('doing it:', n);
    
    const done = function () {
       // console.log('all done with:',n);
       cb.apply(null,arguments);
    };

    if (Math.random() > .5) {
      firstRead(done);
    }
    else {
      firstWrite(done);
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


