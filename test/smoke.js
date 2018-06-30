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

  c.emitter.on('warning', function (v) {
    if(!String(v).match(/no lock with key/)){
      console.error(...arguments);
    }
  });

  const delay = function(v){
    return new Promise((resolve) => setTimeout(resolve,v));
  };

  const start = Date.now();

  const readKey = 'a';
  const writeKey = 'z';

  let readers = 0;
  let writers = 0;

  const readFile = () => {

    const d = Math.ceil(Math.random()*20);

    return delay(d).then(v => c.beginReadp(readKey, {writeKey}).then(v => {

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
    }));
  };

  const writeToFile = () => {

    console.log('writing to file');

    const d = Math.ceil(Math.random()*20);

    return delay(d).then(v => c.beginWritep(writeKey).then(v => {

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
    }));
  };

  let i = 0;
  const x = function(){

    return Promise.all(new Array(10).fill(null).map(v => {

      // console.log('running:',i++);
      if (Math.random() > .2) {
        console.log('doing a reader.');
        return readFile();
      }
      console.log('doing a writer.');
      return writeToFile();
    }));
  };


  let p = Promise.resolve(null);

  for(let i = 0; i < 1000; i++){
     p = p.then(x);
  }

  return p;

})
.catch(e => {
  console.error(e);
  process.exit(1);
});


