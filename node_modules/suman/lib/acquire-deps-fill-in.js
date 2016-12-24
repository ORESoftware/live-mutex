'use strict';

//core
const assert = require('assert');

//npm
const _ = require('lodash');
const colors = require('colors/safe');

//project
const constants = require('../config/suman-constants');

module.exports = function(suman){

  return function (suite, depsObj, cb) {

    const deps = [];

    var err;

    try {

      Object.keys(depsObj).forEach(function (key, index) {

        const dep = depsObj[ key ];

        if (dep) {
          deps.push(dep);
        }
        else if (_.includes(constants.CORE_MODULE_LIST, key)) {
          deps.push(require(key))
        }
        else if (_.includes(constants.SUMAN_HARD_LIST, key)) {
          switch (key) {
            case 'suite':
              deps.push(suite);
              break;
            case 'resume':
            case 'extraArgs':
            case 'getResumeValue':
            case 'getResumeVal':
            case 'writable':
              deps.push(suite[ key ]);
              break;
            case 'describe':
            case 'before':
            case 'after':
            case 'beforeEach':
            case 'afterEach':
            case 'it':
              assert(suite.interface === 'BDD', ' => Suman usage error, using the wrong interface.');
              deps.push(suite[ key ]);
              break;
            case 'test':
            case 'setup':
            case 'teardown':
            case 'setupTest':
            case 'teardownTest':
              assert(suite.interface === 'TDD', ' => Suman usage error, using the wrong interface.');
              deps.push(suite[ key ]);
              break;
            case 'userData':
              deps.push(global.userData);
              break;
            default:
              throw new Error('Not implemented yet => "' + key + '"');
          }
        }
        else if (dep !== undefined) {
          console.error(' => Suman warning => value of dependency for key ="' + key + '" may be unexpected value => ', dep);
          deps.push(dep);
        }
        else {
          throw new Error(colors.red(' => Suman usage error => Dependency not met for: "' + key + '", dependency value is undefined =>' + dep));
        }

      });
    }
    catch ($err) {
      err = $err;
    }
    finally {
      process.nextTick(function () {
        cb(err, deps);
      });

    }

  };

};

