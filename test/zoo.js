'use strict';

const path = require('path');
const async = require('async');
const {Broker, Client} = require('../dist');

///////////////////////////////////////////////////////////////

const conf = Object.freeze({udsPath: path.resolve(process.env.HOME + '/suman.test2.unix.sock')});

Promise.all([
  new Broker().ensure(),
  new Client().connect()
])
.then(function ([b, c]) {

  b.emitter.on('warning', function (v) {
      console.error('broker warning:',...arguments);
  });

  c.emitter.on('warning', function (v) {
      console.error('client warning',...arguments);
  });

  b.emitter.on('error', function (v) {
    console.error('broker error:',...arguments);
  });

  c.emitter.on('error', function (v) {
    console.error('client error',...arguments);
  });

  const start = Date.now();
  const max = 1;

  let count = 0;
  let i = 0;

  async.timesLimit(10000, 30, function (n, cb) {

    const r = Math.ceil(Math.random() * 5);

    c.lock('a', {max}, (err, v) => {

      if (err) {
        return cb(err);
      }

      count++;

      console.log(i++, 'count:', count, 'max:', max);

      if (count > max) {
        throw 'count greater than max.';
      }

      // console.log('count:', ++count);

      setTimeout(function () {
        // v.unlock(cb);

        if (count > max) {
          throw 'count greater than max.';
        }

        count--;

        // console.log('v.id:', v.lockUuid);
        v.unlock(cb);

      }, r);

    });

  }, function (err) {

    if (err) throw err;

    console.log('all done:', Date.now() - start);
  });

});



