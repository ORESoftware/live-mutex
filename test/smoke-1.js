#!/usr/bin/env node
'use strict';

const async = require('async');
const {RWLockClient, Broker} = require('live-mutex');

Promise.all([
  new Broker().ensure(),
  new RWLockClient().connect()
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

  const delay = function (v) {
    return new Promise((resolve) => setTimeout(resolve, v));
  };

  const start = Date.now();

  const readKey = 'reader-key';
  const writeKey = 'writer-key';

  let readers = 0;
  let writers = 0;
  const timeoutSeed = 2;


  const readFile = (cb) => {

    const d1 = Math.ceil(Math.random() * timeoutSeed);

    setTimeout(() => {

      console.log('doing a reader.');

      c.beginRead(readKey, {writeKey, retry: false}, (err, v) => {

        if(err){
          return cb(err);
        }

        readers++;

        console.log('readers count:', readers);

        if (writers > 0) {
          throw 'Reader began when writers were positive [a] => ' + writers;
        }

        const d2 = Math.ceil(Math.random() * timeoutSeed);

        setTimeout(() => {

          readers--;
          console.log('readers count:', readers);

          if (writers > 0) {
            throw 'Reader began when writers were positive [b] => ' + writers;
          }

           v.release(cb);

        }, d2);

      });
    }, d1);
  };

  const writeToFile = (cb) => {

    const d1 = Math.ceil(Math.random() * timeoutSeed);

    setTimeout(() => {

      console.log('doing a writer.');

      c.beginWrite(writeKey, {retry: false} , (err, v) => {

        if (err) {
          return cb(err);
        }

        if (readers > 0) {
          throw 'Writer began when readers were positive [1] => ' + readers;
        }

        if (writers > 0) {
          throw 'Writer began when writers were positive [2] => ' + writers;
        }

        writers++;
        console.log('writers count:', writers);

        const d2 = Math.ceil(Math.random() * timeoutSeed);

        setTimeout(() => {

          writers--;
          console.log('writers count:', writers);

          if (readers > 0) {
            throw 'Writer began when readers were positive [1] => ' + readers;
          }

          if (writers > 0) {
            throw 'Writer began when writers were positive [2] => ' + writers;
          }

          v.release(cb);

        }, d2);

      });

    }, d1);

  };

  async.timesLimit(10000, 2, function (n, cb) {

    console.log('running:', n);

    let d = Math.ceil(Math.random() * 10);
    setTimeout(() => {

      if (Math.random() > .2) {
        readFile(cb);
      }
      else {
        writeToFile(cb);
      }

    }, d);

  }, function (err) {

    if (err) {
      throw err;
    }

    console.log('all done.');

  });

})
.catch(e => {
  console.error(e);
  process.exit(1);
});


