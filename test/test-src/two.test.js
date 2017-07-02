const suman = require('suman');
const Test = suman.init(module);

const colors = require('colors/safe');
const async = require('async');
const _ = require('lodash');


Test.create(function (assert, describe, Client, Broker, inject) {

  const arrays = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 1, 2, 111, 2, 2, 21, 1, 11, 1, 111, 1, 111, 1, 2, 2, 2, 2, 1, 2, 21, 11, 11111, 111, 1, 11, 1, 1, 1, 1, 1, 1, 1],
    ['a', 'a', 'a1', 'a2', 'a2', 'a2', 'a1', 'a2'],
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  ];

  const conf = Object.freeze({port: 7037});

  inject(() => {
    return {
      broker: new Broker(conf).ensure()
    }
  });

  inject( () => {
    return {
      c: new Client(conf).ensure()
    }
  });

  const l = _.flattenDeep(arrays).length;
  console.log(' => length => ', l);

  describe('inject', function (c) {

    arrays.forEach(a => {

      describe.delay('resumes', function (resume) {

        async.map(a, function (val, cb) {

          cb(null, t => {
            c.lock(String(val), function (err, unlock, id) {
              if (err) {
                t.fail(err);
              }
              else {
                setTimeout(function () {
                  c.unlock(String(val), {
                    force: false,
                    _uuid: id
                  }, t.done);
                  // client.unlock(String(val), id, t.done);
                }, 100);
              }
            });
          });

        }, function (err, results) {
          if (err) {
            throw err;
          }

          resume(results);
        });

        describe('handles results', {parallel: true}, function () {

          const fns = this.getResumeValue();

          fns.forEach(fn => {

            this.it.cb('locks/unlocks', fn);

          });

        });

      });

    });

  });

});