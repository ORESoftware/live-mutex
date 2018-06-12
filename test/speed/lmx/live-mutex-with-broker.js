'use strict';

const async = require('async');
const lmUtils = require('live-mutex/utils');
const {Broker, Client} = require('live-mutex');
// const conf = Object.freeze({port: 6970});

const path = require('path');
const conf = Object.freeze({udsPath: path.resolve(process.env.HOME + '/simple.unix.sock')});
const util = require('util');

process.on('unhandledRejection', function (e) {
  console.error('unhandledRejection => ', e.stack || e);
});

///////////////////////////////////////////////////////////////////

Promise.all([
  new Broker(conf).ensure(),
  // console.log(''),
  new Client(conf).ensure()
])
.then(function ([b, c]) {

  b.emitter.on('warning', function () {
    console.log(...arguments);
  });

  c.emitter.on('warning', function () {
    console.log(...arguments);
  });

  const a = Array.apply(null, {length: 10000});
  const start = Date.now();

  let counts = {
    z: 0
  };

  async.eachLimit(a, 8, function (val, cb) {

    c.lock('foo', function (err, unlock) {

      if (err) {
        return cb(err);
      }

      setTimeout(function(){
        unlock(cb);
      }, Math.ceil(Math.random()*5));

    });

  }, function complete(err) {

    if (err) {
      throw err;
    }

    const diff = Date.now() - start;
    console.log(' => Time required for live-mutex => ', diff);
    console.log(' => Lock/unlock cycles per millisecond => ', Number(a.length / diff).toFixed(3));
    process.exit(0);
  });

});







