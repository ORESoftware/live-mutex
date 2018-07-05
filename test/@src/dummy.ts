'use strict';

const async = require('async');
const lmUtils = require('live-mutex/utils');
const {Broker, Client} = require('live-mutex');
const conf = Object.freeze({port: 6970});
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

  const start = Date.now();

  let counts = {
    z: 0
  };

  const times = 10000;

  async.timesLimit(times, 25, function (val, cb) {

    c.lock('foo', function (err, unlock) {

      if (err) {
        return cb(err);
      }

      try {
        // console.log('unlocking...' + counts.z++);
        // console.log(util.inspect(unlock));

        // client.unlock('foo',cb);

        unlock(cb);
      }
      catch (err) {
        return cb(err);
      }

    });

  }, function complete(err) {

    if (err) {
      throw err;
    }

    const diff = Date.now() - start;
    console.log(' => Time required for live-mutex => ', diff);
    console.log(' => Lock/unlock cycles per millisecond => ', Number(times / diff).toFixed(3));
    process.exit(0);
  });

});







