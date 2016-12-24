'use striiiict';

//core
const assert = require('assert');
const util = require('util');
const EE = require('events');

//npm
const _ = require('lodash');
const fnArgs = require('function-arguments');

//project
const constants = require('../config/suman-constants');
const individualIntegrantEmitter = global.individualIntegrantEmitter = (global.individualIntegrantEmitter || new EE());
const integContainer = global.integContainer = (global.integContainer || new EE());
const integProgressContainer = global.integProgressContainer = (global.integProgressContainer || new EE());

/////////////////////////////////////////////////////////////////////////////

individualIntegrantEmitter.setMaxListeners(250); //magic number ftw

//////////////////////////////////////////////////////////////////////////////

module.exports = function acquireDepsOriginal (deps, depConfiguration, cb) {

  const obj = {};

  deps.forEach(dep => {

    //TODO, we should validate the suman.ioc.js file independently of this check, later on
    //TODO: Check to make sure dep name is not "undefined"?

    if (_.includes(constants.SUMAN_HARD_LIST, dep && String(dep)) && String(dep) in depConfiguration) {
      console.error('Warning: you added an integrant dependency for "' + dep +
        '" but this is a reserved internal Suman dependency injection value.');
      throw new Error('Warning: you added a integrant dependency for "' + dep +
        '" but this is a reserved internal Suman dependency injection value.');
    }

    else if (_.includes(constants.CORE_MODULE_LIST, dep && String(dep)) && String(dep) in depConfiguration) {
      console.error('Warning: you added a integrant dependency for "' + dep +
        '" but this is a reserved Node.js core module dependency injection value.');
      throw new Error('Warning: you added a integrant dependency for "' + dep +
        '" but this is a reserved Node.js core module dependency injection value.');
    }

    //TODO: maybe just fill these in here instead of later
    // else if (_.includes(constants.CORE_MODULE_LIST, dep && String(dep)) || _.includes(constants.SUMAN_HARD_LIST, String(dep))) {
    //   //skip any dependencies
    //   obj[ dep ] = null;
    // }
    else {

      obj[ dep ] = depConfiguration[ dep ]; //copy subset of iocConfig to test suite

      if (!obj[ dep ]) {

        // var deps = Object.keys(depConfiguration || {}).map(function (item) {
        //   return ' "' + item + '" ';
        // });

        throw new Error('The following desired integrant is not defined: "' + dep + '"\n' +
          ' => ...your integrant configuration is: ' + util.inspect(depConfiguration));
      }
    }

  });

  const providers = Object.keys(obj).map(function (key) {

    console.log('obj',util.inspect(obj));
    console.log('key',util.inspect(key));


    const fn = obj[ key ];

    console.log('fn',util.inspect(String(fn)));


    const cache = integContainer[ key ];
    const inProgress = integProgressContainer[ key ];

    console.log('cache',util.inspect(cache));
    console.log('inProgress',util.inspect(inProgress));

    return function () {

      return new Promise(function (resolve, reject) {

        if (!fn) {
          // most likely a core dep (assert, http, etc)
          // console.log(' => Suman warning => fn is null/undefined for key = "' + key + '"');
          reject(new Error('null or undefined integrant value for key => "' + key + '"'));
        }
        else if (typeof fn !== 'function') {
          const err = new Error('Value in IOC object was not a function for corresponding key => ' +
            '"' + key + '", value => "' + util.inspect(fn) + '"');
          console.log('\n', err.stack, '\n');
          reject(err);
        }
        else if (cache) {
          if (process.env.SUMAN_DEBUG === 'yes') {
            console.log('CACHE WAS USED for key = "' + key + '"');
          }
          assert(inProgress === 'done', 'integProgressContainer should have "done" value for key = "' + key + '"');
          resolve(cache);
        }
        else if (inProgress === true) {
          if (process.env.SUMAN_DEBUG === 'yes') {
            console.log('IN PROGRESS WAS USED for key = "' + key + '".');
          }

          individualIntegrantEmitter.once(key, resolve);
          individualIntegrantEmitter.once('error', reject);
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

          if (key in integProgressContainer) {
            throw new Error(' => Suman internal error => "' + key + '" should not already be in integProgressContainer');
          }
          integProgressContainer[ key ] = true;

          fn.apply(global, [ function (err, val) { //TODO what to use for ctx of this .apply call?
            if (err) {
              // integProgressContainer[key] = err; //TODO: should we really put the error in the cache?
              individualIntegrantEmitter.emit('error', err);
              reject(err);
            }
            else {
              integProgressContainer[ key ] = 'done';
              integContainer[ key ] = val;
              individualIntegrantEmitter.emit(key, val);
              resolve(val);
            }
          }
          ]);
        }
        else {

          if (key in integProgressContainer) {
            throw new Error(' => Suman internal error => "' + key + '" should not already be in integProgressContainer');
          }

          integProgressContainer[ key ] = true;

          Promise.resolve(fn.apply(global, [])).then(function res (val) {
            integContainer[ key ] = val;
            integProgressContainer[ key ] = 'done';
            individualIntegrantEmitter.emit(key, val);
            resolve(val);
          }, function rej (err) {
            integProgressContainer[ key ] = err;
            individualIntegrantEmitter.emit('error', err);
            reject(err);
          });
        }

      });
    }

  });

  Promise.all(providers.map(provider => provider.apply(null))).then(
    function (deps) {
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
    }
  ).catch(function (err) {
    console.error(err.stack || err);
  });
};