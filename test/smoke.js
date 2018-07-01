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

  const delay = function (v) {
    return new Promise((resolve) => setTimeout(resolve, v));
  };

  const start = Date.now();

  const readKey = 'aaaaa';
  const writeKey = 'zzzzz';

  let readers = 0;
  let writers = 0;

  const readFile = () => {

    const d1 = Math.ceil(Math.random() * 20);

    return delay(d1).then(v => c.beginReadp(readKey, {writeKey}).then(v => {

      readers++;

      if (writers > 0) {
        throw 'Reader began when writers were positive [a] => ' + writers;
      }

      const d2 = Math.ceil(Math.random() * 20);

      return delay(d2).then(v => {

        readers--;

        if (writers > 0) {
          throw 'Reader began when writers were positive [b] => ' + writers;
        }

        return c.endReadp(readKey, {writeKey});

      });
    }));
  };

  const writeToFile = () => {

    const d1 = Math.ceil(Math.random() * 20);

    return delay(d1).then(v => c.beginWritep(writeKey).then(v => {

      if (readers > 0) {
        throw 'Writer began when readers were positive [1] => ' + readers;
      }

      if (writers > 0) {
        throw 'Writer began when writers were positive [2] => ' + writers;
      }

      writers++;

      const d2 = Math.ceil(Math.random() * 20);

      return delay(d2).then(v => {

        writers--;

        if (readers > 0) {
          throw 'Writer began when readers were positive [1] => ' + readers;
        }

        if (writers > 0) {
          throw 'Writer began when writers were positive [2] => ' + writers;
        }

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

  for (let i = 0; i < 10; i++) {
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


