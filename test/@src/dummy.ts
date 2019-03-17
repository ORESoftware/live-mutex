'use strict';

import async = require('async');
import {lmUtils} from 'live-mutex';
import {Broker, Client} from 'live-mutex';
const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
const conf = Object.freeze({port});
import util = require('util');

process.on('unhandledRejection', function (e) {
  console.error('unhandledRejection => ', e.stack || e);
});

///////////////////////////////////////////////////////////////////

Promise.all([
  ((() => {
    const brokerConf = Object.assign({}, conf, {noListen: process.env.lmx_broker_no_listen === 'yes'});
    return new Broker(conf).ensure()
  })()),
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







