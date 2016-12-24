'use striiiict';

//core
const assert = require('assert');
const util = require('util');

//npm
const _ = require('lodash');
const fnArgs = require('function-arguments');

//project
const constants = require('../config/suman-constants');
const iocEmitter = global.iocEmitter;
const iocContainer = global.iocContainer;
const iocProgressContainer = global.iocProgressContainer;

/////////////////////////////////////////////////////////////////////////////

iocEmitter.setMaxListeners(250); //magic number ftw

//////////////////////////////////////////////////////////////////////////////


module.exports = function acquireDepsOriginal (deps, cb) {

  const obj = {};

  deps.forEach(dep => {

    //TODO, we should validate the suman.ioc.js file independently of this check, later on
    //TODO: Check to make sure dep name is not undefined?

    if (_.includes(constants.SUMAN_HARD_LIST, dep && String(dep)) && String(dep) in global.iocConfiguration) {
      console.log('Warning: you added a IoC dependency for "' + dep + '" but this is a reserved internal Suman dependency injection value.');
      throw new Error('Warning: you added a IoC dependency for "' + dep + '" but this is a reserved internal Suman dependency injection value.');
    }

    else if (_.includes(constants.CORE_MODULE_LIST, dep && String(dep)) && String(dep) in global.iocConfiguration) {
      console.log('Warning: you added a IoC dependency for "' + dep + '" but this is a reserved Node.js core module dependency injection value.');
      throw new Error('Warning: you added a IoC dependency for "' + dep + '" but this is a reserved Node.js core module dependency injection value.');
    }

    //TODO: maybe just fill these in here instead of later
    else if (_.includes(constants.CORE_MODULE_LIST, dep && String(dep)) || _.includes(constants.SUMAN_HARD_LIST, String(dep))) {
      //skip any dependencies
      obj[ dep ] = null;
    }
    else {

      obj[ dep ] = global.iocConfiguration[ dep ]; //copy subset of iocConfig to test suite

      if (!obj[ dep ] && !_.includes(constants.CORE_MODULE_LIST, String(dep)) && !_.includes(constants.SUMAN_HARD_LIST, String(dep))) {

        var deps = Object.keys(global.iocConfiguration || {}).map(function (item) {
          return ' "' + item + '" ';
        });

        throw new Error('The following desired dependency is not in your suman.ioc.js file: "' + dep + '"\n' +
          ' => ...your available dependencies are: [' + deps + ']');
      }
    }

  });

  const temp = Object.keys(obj).map(function (key) {

    const fn = obj[ key ];
    const cache = iocContainer[ key ];
    const inProgress = iocProgressContainer[ key ];

    return new Promise(function (resolve, reject) {

      if (!fn) {
        // most likely a core dep (assert, http, etc)
        // console.log(' => Suman warning => fn is null/undefined for key = "' + key + '"');
        process.nextTick(resolve);
      }
      else if (typeof fn !== 'function') {
        process.nextTick(function () {
          const err = new Error('Value in IOC object was not a function for corresponding key => ' +
            '"' + key + '", value => "' + util.inspect(fn) + '"');
          console.log('\n', err.stack, '\n');
          reject(err);
        });
      }
      else if (cache) {
        if (process.env.SUMAN_DEBUG === 'yes') {
          console.log('CACHE WAS USED for key = "' + key + '"');
        }
        assert(inProgress === 'done', 'iocProgressContainer should have "done" value for key = "' + key + '"');
        process.nextTick(function () {
          resolve(cache);
        });
      }
      else if (inProgress === true) {
        if (process.env.SUMAN_DEBUG === 'yes') {
          console.log('IN PROGRESS WAS USED for key = "' + key + '".');
        }

        iocEmitter.once(key, resolve);
        iocEmitter.once('error', reject);
      }
      else if (fn.length > 1) {
        reject(new Error(colors.red(' => Suman usage error => suman.ioc.js functions take 0 or 1 arguments, with the single argument being a callback function.')));
      }
      else if (fn.length > 0) {
        var args = fnArgs(fn);
        var str = fn.toString();
        var matches = str.match(new RegExp(args[ 1 ], 'g')) || [];
        if (matches.length < 2) { //there should be at least two instances of the 'cb' string in the function, one in the parameters array, the other in the fn body.
          throw new Error('Callback in your function was not present => ' + str);
        }

        if (key in iocProgressContainer) {
          throw new Error(' => Suman internal error => "' + key + '" should not already be in iocProgressContainer');
        }
        iocProgressContainer[ key ] = true;

        fn.apply(global, [ function (err, val) { //TODO what to use for ctx of this .apply call?
          process.nextTick(function () {
            if (err) {
              // iocProgressContainer[key] = err; //TODO: should we really put the error in the cache?
              iocEmitter.emit('error', err);
              reject(err);
            }
            else {
              iocProgressContainer[ key ] = 'done';
              iocContainer[ key ] = val;
              iocEmitter.emit(key, val);
              resolve(val);
            }
          });
        } ]);
      }
      else {

        if (key in iocProgressContainer) {
          throw new Error(' => Suman internal error => "' + key + '" should not already be in iocProgressContainer');
        }

        iocProgressContainer[ key ] = true;

        Promise.resolve(fn.apply(global, [])).then(function res (val) {
          iocContainer[ key ] = val;
          iocProgressContainer[ key ] = 'done';
          iocEmitter.emit(key, val);
          resolve(val);
        }, function rej (err) {
          iocProgressContainer[ key ] = err;
          iocEmitter.emit('error', err);
          reject(err);
        });
      }

    });

  });

  Promise.all(temp).then(function (deps) {

      Object.keys(obj).forEach(function (key, index) {
        obj[ key ] = deps[ index ];
      });
      //want to exit out of current tick
      process.nextTick(function () {
        cb(null, obj);
      });

    },
    function (err) {
      console.error(err.stack || err);
      //want to exit out of current tick
      process.nextTick(function () {
        cb(err, {});
      });
    });
};