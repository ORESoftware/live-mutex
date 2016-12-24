'use striiict';

//core
const util = require('util');

/////////////////////////////////////////////////////////////////////

module.exports = function (run, opts, cb, fns, completeFns) {

  const makeRunCB = function (obj) {

    return global.backspacingFn = function () {

      global.backspacing = true;

      var fn;
      if (completeFns.length < 1) {
        fn = cb;
      }
      else {
        fn = run.bind(null, obj, cb);
      }
      const s2 = completeFns.shift();
      // _interactiveDebug('s2 => ', String(s2));
      if (s2) {
        fns.unshift(s2);
      }
      fn();
    }

  };

  return fns.reduce(function (prev, curr, index) {

    return prev.then(function (obj) {

      if (String(obj) === 'backspacing') {
        return Promise.reject('backspacing');
      }

      const runCB = makeRunCB(obj);

      if (index > 0) {

        const s1 = fns.shift();
        // _interactiveDebug('s1 => ', String(s1));
        if (!s1) {
          throw new Error(' => Suman interactive implementation error.');
        }
        completeFns.unshift(s1);
      }

      return curr(obj, runCB);

    });

  }, Promise.resolve(opts)).catch(function (e) {
    if (!String(e.stack || e).match(/backspacing/)) {
      _interactiveDebug('NON BACKSPACING ERROR 2 => ', e.stack || e);
      throw new Error(e.stack || e);
    }
    else{
      throw new Error('backspacing');
    }

  });

};