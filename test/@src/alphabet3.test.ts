'use strict';

import suman = require('suman');
const Test = suman.init(module);
const async = require('async');
import {Broker} from "../../dist/broker";
import * as path from "path";
import * as fs from 'fs';
import cp = require('child_process');

////////////////////////////////////////////////////////

Test.create(['lmUtils', (b, assert, before, describe, it, path, inject, after) => {

  const {lmUtils} = b.ioc;
  const alphabetFixture = path.resolve(__dirname + '/../fixtures/alphabet3.txt');
  const alphabetFixtureResult = path.resolve(__dirname + '/../fixtures/alphabet3.result.txt');
  const original = 'abcdefghijklmnopqrstuvwxyz';

  const port = 7000 + parseInt(process.env.SUMAN_CHILD_ID || '1');
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

  inject(j => {
    j.register('broker', new Broker(conf).ensure().then(handleEvents));
  });

  before.cb(h => {
    fs.writeFile(alphabetFixture, original, h);
  });

  before.cb(h => {
    fs.writeFile(alphabetFixtureResult, '', h);
  });

  describe('post', function (b) {

    const broker = b.getInjectedValue('broker') as Broker;

    after.cb(h => {
      console.log('closing broker...');
      return broker.close(h);
    });

    it.cb('check original file', t => {
      fs.readFile(alphabetFixture, function (err, result) {
        t.final(function () {
          t.assert(String(result || '') === original)
        });
      });
    });

    it.cb('check destination file', t => {
      fs.readFile(alphabetFixtureResult, function (err, result) {
        t.final(function () {
          t.assert(String(result || '') === '');
        });
      });
    });

    it.cb('all', {timeout: 50000}, t => {

      const childPath = path.resolve(__dirname + '/../fixtures/client-child.js');

      async.times(5, function (n, cb) {

        const k = cp.spawn('node', [childPath], {
          env: Object.assign({}, process.env, {
            lm_alphabet_from: alphabetFixture,
            lm_alphabet_to: alphabetFixtureResult,
            lm_port: conf.port,
            lm_lock_name: 'barzan'
          })
        });

        k.stderr.pipe(process.stderr);
        k.once('exit', cb);

      }, function (err) {

        if (err) {
          return t.done(err);
        }

        fs.readFile(alphabetFixtureResult, function (err, res) {

          if (err) {
            return t.done(err);
          }

          if (String(res).trim() === original) {
            console.log('original:', original);
            console.log('the result:', String(res));
            return t.done(null);
          }

          t.done(new Error('this is the end - bad match -> ' + res));

        });

      });

    });

  });

}]);