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
    if (!String(v).match(/no lock with key/)) {
      console.error(...arguments);
    }
  });

  c.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error(...arguments);
    }
  });

  const start = Date.now();

  async.timesLimit(10000, 20, function (n, cb) {

    const r = Math.ceil(Math.random() * 2);

    c.lock('a', (err, v) => {

      if (err) {
        return cb(err);
      }

      v.unlock(cb);
      // setTimeout(function () {
      //
      // }, r);

    });

  }, function (err) {

    if (err) throw err;

    console.log('all done:', Date.now() - start);
  });

});



