'use strict';

const async = require('async');
const lmUtils = require('live-mutex/utils');
const {Broker, Client} = require('live-mutex');
const conf = Object.freeze({port: 7003});
const util = require('util');

process.on('unhandledRejection', function (e) {
  console.error('unhandledRejection => ', e.stack || e);
});

///////////////////////////////////////////////////////////////////

Promise.all([
  new Broker(conf).ensure(),
  new Client(conf).ensure()
])
.then(function ([b, c]) {

  const a = Array.apply(null, {length: 10000});
  const start = Date.now();

  var counts = {
    z: 0
  };

  async.eachLimit(a, 25, function (val, cb) {

    c.lock('foo', function (err, unlock) {

      if (err) {
        return cb(err);
      }

      try {
        console.log('unlocking...' + counts.z++);
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
    console.log(' => Lock/unlock cycles per millisecond => ', Number(a.length / diff).toFixed(3));
    process.exit(0);
  });

});







