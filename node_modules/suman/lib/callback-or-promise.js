'use striiiict';

//core
const domain = require('domain');
const assert = require('assert');
const util = require('util');

//npm
const sumanUtils = require('suman-utils/utils');

//project
const makeGen = require('./helpers/async-gen');


/////////////////////////////////////////////////////////////////

module.exports = function callbackOrPromise (key, hash, cb) {

  const d = domain.create();

  var called = false;

  function first () {
    if (!called) {
      called = true;
      d.exit();
      const args = arguments;
      process.nextTick(function () {
        cb.apply(null, args);
      });
    }
    else {
      console.error.apply(console, arguments);
    }
  }

  d.once('error', function (err) {
    console.log(err.stack || err);
    first(err);
  });

  d.run(function () {
    process.nextTick(function () {
      const fn = hash[ key ];

      assert(typeof fn === 'function', 'Integrant listing is not a function => ' + key,
        '\n\n => instead we have => \n\n', util.inspect(fn));

      const isGeneratorFn = sumanUtils.isGeneratorFn(fn);

      if (isGeneratorFn && fn.length > 0) {
        first(new Error(' => Suman usage error, you have requested a callback to a generator function => \n' + fn.toString()));
      }
      else if (isGeneratorFn) {
        const gen = makeGen(fn, null);
        gen.apply(null, []).then(function (val) {
          first(null, val);
        }, first);
      }
      else if (fn.length > 0) {

        fn.apply(null, [ function (err, val) {
          err ? first(err) : first(null, val);
        } ]);

      }
      else {
        Promise.resolve(fn.apply(global, [])).then(function (val) {
          //TODO: we could send val to indvidual tests, in the form of JSON
          first(null, val);

        }, first);
      }
    });
  });

};