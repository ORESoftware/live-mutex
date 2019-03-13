'use strict';

import async = require('async');
import {lmUtils} from 'live-mutex';
import {Broker, Client} from 'live-mutex';
const path = require('path');
// const conf = Object.freeze({port: 5970});
const conf = Object.freeze({udsPath: path.resolve(process.env.HOME + '/uds_live_mutex')});
import util = require('util');

process.on('unhandledRejection', function (e) {
  console.error('unhandledRejection => ', e.stack || e);
});

///////////////////////////////////////////////////////////////////

Promise.all([
    new Broker(conf).ensure(),
    new Client(conf).ensure()
  ])
  .then(function ([b, c]) {
    
    b.emitter.on('warning', function () {
      console.log(...arguments);
    });
    
    c.emitter.on('warning', function () {
      console.log(...arguments);
    });
    
    const times = 10000, start = Date.now();
    
    async.timesLimit(times, 25, async val => {
      
      const {id,key} = await c.acquire('foo');
      // do your thing here
      return await c.release(key,id);
      
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







