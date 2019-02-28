#!/usr/bin/env node
'use strict';

const {Client, Broker} = require('live-mutex');
const async = require('async');

Promise.all([
  new Broker().ensure(),
  new Client().connect()
])
.then(function ([b, c]) {

  b.emitter.on('error', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('broker error:',...arguments);
    }
  });

  c.emitter.on('error', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('client error',...arguments);
    }
  });

  b.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('broker warning:',...arguments);
    }
  });

  c.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('client warning',...arguments);
    }
  });


  const start = Date.now();
  const max = 22;

  const firstRead = function (cb) {
    c.lock('foo', {max},(err, release) => {
      if(err){
        return cb(err);
      }
      if(release.acquired !== true){
        throw release;
      }

      release(cb);
    });
  };

  const firstWrite = function (cb) {
    c.lock('foo', {max},(err, release) => {
      if(err){
        return cb(err);
      }
      if(release.acquired !== true){
        throw release;
      }

      release(cb);
    });
  };

  async.timesLimit(10000, 25, function (n, cb) {

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


