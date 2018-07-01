'use strict';

import * as suman from 'suman';
const {Test} = suman.init(module);
import async = require('async');
import {Broker, Client} from '../../dist';

///////////////////////////////////////////////////////////////

Test.create(['Promise', function (b, it, inject, describe, before, $deps, path) {

  const conf = Object.freeze({udsPath: path.resolve(process.env.HOME + '/suman.test2.unix.sock')});

  inject(() => {
    return {
      broker: new Broker(conf).ensure()
    }
  });


  before('get client', h => {
    return new Client(conf).ensure().then(function (client) {
      h.supply.client = client;
    });
  });

  describe('injected', function (b) {

    it.cb('locks/unlocks', {timeout: 7000}, t => {

      const c = t.supply.client;

      async.timesLimit(1000, 20, function(n, cb){

        const r = Math.ceil(Math.random()*5);

        c.lock('a',  (err, v) => {

          if (err) {
            return cb(err);
          }

          setTimeout(function () {
            v.unlock(cb);
          }, r);

        });

      }, t);


    });


  });

}]);
