'use strict';

import suman = require('suman');
const Test = suman.init(module);
const async = require('async');
import {Client} from "../../dist/client";
import {Broker} from "../../dist/broker";

// @ts-ignore
Test.create(['lmUtils', (b, assert, before, describe, it, path, fs, inject, after) => {

  const {lmUtils} = b.ioc;

  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const a2z = alphabet.split('');
  assert.equal(a2z.length, 26, ' => Western alphabet is messed up.');

  const num = 100;
  const noListen = process.env.lmx_broker_no_listen === 'yes';
  const port = 6970;
  // const port = noListen ? 6970 : (
  //   process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1')));
  const conf = Object.freeze({port});

  const handleEvents = function (v) {

    v.emitter.on('warning', w => {
      console.error('warning:', w);
    });

    v.emitter.on('error', w => {
      console.error('error:', w);
    });

    return v;
  };
  
  console.log({port});

  inject(j => {
    const brokerConf = Object.assign({}, conf, {noListen});
    j.register('broker', new Broker(brokerConf).ensure().then(handleEvents));
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