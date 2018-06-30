#!/usr/bin/env node
'use strict';

const {Client, Broker} = require('live-mutex');

Promise.all([
  new Broker().ensure(),
  new Client().connect()
])
.then(function ([b, c]) {

  b.emitter.on('warning', function (v) {
    if(!String(v).match(/no lock with key/)){
      console.error(...arguments);
    }
  });

  c.emitter.on('warning', function () {
    if(!String(v).match(/no lock with key/)){
      console.error(...arguments);
    }
  });

  const start = Date.now();

  const readKey = 'a';
  const writeKey = 'z';

  let readers = 0;
  let writers = 0;

  const readFile = () => {
    return c.beginReadp(readKey, {writeKey}).then(v => {

      readers++;

      if(writers > 0){
        throw 'Reader began when writers were positive => ' + writers;
      }

      return c.endReadp(readKey, {writeKey}).then(v => {

        readers--;

        if(writers > 0){
          throw 'Reader began when writers were positive => ' + writers;
        }

      });
    });
  };

  const writeToFile = () => {

    console.log('writing to file');

    return c.beginWritep(writeKey).then(v => {

      console.log('done with begin write.');

       if(readers > 0){
         throw 'Writer began when readers were positive => ' + readers;
       }

      if(writers > 0){
        throw 'Writer began when writers were positive => ' + writers;
      }

      writers++;

      return c.endWritep(writeKey).then(v => {

        console.log('done with end write.');

        writers--;

        if(readers > 0){
          throw 'Writer began when readers were positive => ' + readers;
        }

        if(writers > 0){
          throw 'Writer began when writers were positive => ' + writers;
        }

      });
    });
  };

  return Promise.all(new Array(1000).fill(null).map(v => {
    if (Math.random() > .2) {
      return readFile();
    }
    return writeToFile();
  }));

})
.catch(e => {
  console.error(e);
  process.exit(1);
});


