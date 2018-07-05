#!/usr/bin/env node
'use strict';

const {RWLockClient, Broker} = require('live-mutex');

Promise.all([
  new Broker().ensure(),
  new RWLockClient().connect()
])
.then(function ([b, c]) {

  b.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('broker warning:',...arguments);
    }
  });

  c.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('client warning:',...arguments);
    }
  });

  b.emitter.on('error', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('broker error:',...arguments);
    }
  });

  c.emitter.on('error', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('client error:',...arguments);
    }
  });

  const delay = function (v) {
    return new Promise((resolve) => setTimeout(resolve, v));
  };

  const start = Date.now();

  const readKey = 'reader-lock-key';
  const writeKey = 'writer-lock-key';

  let readers = 0;
  let writers = 0;
  const toSeed = 12;

  const readFile = () => {

    const d1 = Math.ceil(Math.random() * toSeed);

    return delay(d1).then(v => c.beginReadp(readKey, {writeKey}).then(v => {

      readers++;

      console.log('readers count:', readers);

      // if (writers > 0) {
      //   throw 'Reader began when writers were positive [a] => ' + writers;
      // }

      const d2 = Math.ceil(Math.random() * toSeed);

      return delay(d2).then(v => {

        readers--;
        console.log('readers count:', readers);

        // if (writers > 0) {
        //   throw 'Reader began when writers were positive [b] => ' + writers;
        // }

        return c.endReadp(readKey, {writeKey});

      });
    }));
  };

  const writeToFile = () => {

    const d1 = Math.ceil(Math.random() * toSeed);

    return delay(d1).then(v => c.beginWritep(writeKey).then(v => {

      // if (readers > 0) {
      //   throw 'Writer began when readers were positive [1] => ' + readers;
      // }
      //
      // if (writers > 0) {
      //   throw 'Writer began when writers were positive [2] => ' + writers;
      // }

      writers++;
      console.log('writers count:', writers);


      const d2 = Math.ceil(Math.random() * 20);

      return delay(d2).then(v => {

        writers--;
        console.log('writers count:', writers);


        // if (readers > 0) {
        //   throw 'Writer began when readers were positive [1] => ' + readers;
        // }
        //
        // if (writers > 0) {
        //   throw 'Writer began when writers were positive [2] => ' + writers;
        // }

        return c.endWritep(writeKey);

      });

    }));
  };

  let i = 0;
  const x = function () {

    return Promise.all(new Array(10).fill(null).map(v => {

      console.log('running:',i++);

      if (Math.random() > .2) {
        console.log('doing a reader.');
        return readFile();
      }
      console.log('doing a writer.');
      return writeToFile();
    }));
  };

  let p = Promise.resolve(null);

  const z = 1;

  for (let i = 0; i < z; i++) {     // z at a time (z is concurrency)
    let d = Math.ceil(Math.random()*1000);
    p = delay(d).then(v => x());
  }

  return p;

})
.then(function () {
  console.log('all done I guess.');
})
.catch(e => {
  console.error(e);
  process.exit(1);
});


