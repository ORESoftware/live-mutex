'use strict';

const async = require('async');
const {Client} = require('../../dist');
const fs = require('fs');
const port = parseInt(process.env.lm_port || '');
const lockName = process.env.lm_lock_name;
const lmAlphaFrom = process.env.lm_alphabet_from;
const lmAlphaTo = process.env.lm_alphabet_to;
const c = new Client({port});

c.emitter.on('warning', function () {
  console.error('client warning:', ...arguments);
});

let search = true;

async.whilst(
  function () {
    return search === true;
  },

  function (cb) {

    c.ensure(function (err) {

      if (err) {
        return cb(err);
      }

      setTimeout(function () {

        c.lock(lockName, function (err, unlock) {

          if (err) {
            return cb(null);
          }

          fs.readFile(lmAlphaFrom, function (err, res) {

            if (err) {
              return cb(err);
            }

            const v = String(res || '').split('');
            const myChar = v.shift();

            if (!myChar) {
              search = false;
              return cb(null);
            }

            fs.writeFile(lmAlphaFrom, v.join(''), function (err) {

              if (err) {
                return cb(err);
              }

              fs.appendFile(lmAlphaTo, myChar, function (err) {

                if (err) {
                  return cb(err);
                }

                unlock(cb);

              });

            });

          });

        });

      }, Math.random() * 100);

    });

  },

  function (err) {

    if (err) {
      throw err;
    }

    process.exit(0);
  });




