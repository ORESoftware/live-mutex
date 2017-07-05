'use strict';

import suman from 'suman';
const Test = suman.init(module);

const colors = require('colors/safe');
const async = require('async');
const _ = require('lodash');

// import the other way, just to be sure
import {Client, Broker, lmUtils}  from 'live-mutex';

Test.create(function (assert, fs, path, inject, describe, before, it) {

  const conf = Object.freeze({port: 7027});

  let p ;

  inject(() => {
    return {
      broker: p = new Broker(conf).ensure()
    }
  });

  inject(() => {
    return {
      c: p.then(v => new Client(conf).ensure())
    }
  });

  const f = require.resolve('../fixtures/corruptible.txt');

  before.cb('remove file', function (t) {
    fs.writeFile(f, '', t);
  });

  describe('inject', function (c) {

    function lockWriteRelease(val, cb) {

      c.lock('a', function (err, unlock) {
        if (err) {
          cb(err);
        }
        else {
          fs.appendFile(f, '\n' + String(val), function (err) {
            if (err) {
              cb(err);
            }
            else {
              unlock(cb);
            }

          });
        }
      });
    }

    before.cb('write like crazy', {timeout: 30000}, t => {

      const a = Array.apply(null, {length: 20}).map((item, index) => index);
      async.each(a, lockWriteRelease, t.done);

    });

    it.cb('ensure that file still has the same stuff in it!', {timeout: 30000}, t => {

      fs.readFile(f, function (err, data) {
        if (err) {
          return t.fail(err);
        }

        const arr = String(data).split('\n').filter(function (line) {
          return String(line).trim().length > 0;
        });

        arr.forEach(function (item, index) {
          assert.equal(String(item), String(index), 'item and index are not equal');
        });

        t.done(null);

      });

    });

  });

});