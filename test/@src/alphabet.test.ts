'use strict';

import suman = require('suman');
const Test = suman.init(module);
const async = require('async');
import {Client} from "../../client";
import {Broker} from "../../broker";

////////////////////////////////////////////////////////

Test.create(['lmUtils', (b, assert, before, describe, it, path, fs, inject, after) => {

  const {lmUtils} = b.ioc;

  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const a2z = alphabet.split('');
  assert.equal(a2z.length, 26, ' => Western alphabet is messed up.');

  const num = 100;

  const conf = Object.freeze({port: 7028});

  const handleEvents = function (v) {

    v.emitter.on('warning', w => {
      console.error('warning:', w);
    });

    v.emitter.on('error', w => {
      console.error('error:', w);
    });

    return v;
  };

  inject(j => {
    j.register('broker', new Broker(conf).ensure().then(handleEvents));
  });

  inject(j => {
    j.register('client', new Client(conf).ensure().then(handleEvents));
  });

  const p = path.resolve(__dirname + '/../fixtures/alphabet.test');

  // before.cb('clean up file', h => {
  //   fs.writeFile(p, '', h);
  // });

  const strm = fs.createWriteStream(p);

  describe('post', function (b) {

    const client = b.getInjectedValue('client') as Client;
    const broker = b.getInjectedValue('broker') as Broker;

    after.cb(h => {
      console.log('closing broker...');
      return broker.close(h);
    });

    before.cb('yo', h => {

      async.eachLimit(a2z, 1, function (val, cb) {

        client.lock('foo', {max: 5}, function (err, v) {

          console.log('we have a lock on val:', val);

          const r = Math.ceil(Math.random() * 20);

          setTimeout(() => {
            for (let i = 0; i < num; i++) {
              strm.write(val);
            }
            v.unlock(cb);

          }, r);

        });

      }, h.done);

    });

    it.cb('count characters => expect num*26', {timeout: 300}, t => {

      fs.readFile(p, function (err, data) {

        if (err) {
          return t.done(err);
        }

        assert.equal(String(data).trim().length, (26 * num));
        t.done();

      });
    });

    it.cb('10 chars of each, in order', {timeout: 300}, t => {

      const readable = fs.createReadStream(p);

      readable.once('error', t.fail);
      readable.once('end', t.done);

      readable.on('readable', function () {

        let index = 0;
        let chunk;
        while (null != (chunk = readable.read(1))) {

          const temp = (index - (index % num)) / num;
          assert.equal(String(chunk), alphabet[temp]);
          index++;
        }

      });
    });

  });

}]);