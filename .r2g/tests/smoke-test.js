#!/usr/bin/env node
'use strict';

const {Client, Broker} = require('live-mutex');

Promise.all([
  new Broker().ensure(),
  new Client().connect()
])
.then(function ([b, c]) {

  b.emitter.on('warning', function () {
    console.error('broker warning:', ...arguments);
  });

  c.emitter.on('warning', function () {
    console.error('client warning:', ...arguments);
  });

  const promises = new Array(20).fill(null).map(v => {
   return c.lockp('foo').then(v => {

     const rand = Math.random()*300;
     return new Promise(r => setTimeout(r,rand)).then(_  => v);
    })
    .then(({key, id}) =>  c.unlockp(key, id));
  });

  return Promise.all(promises)
  .then(values => {

    console.log('all good');
    process.exit(0);

  });

})
.catch(e => {
  console.error(e);
  process.exit(1);
});


