//******************************************************************************************************************
// this is for dependency injection, y'all
// the purpose is to inject dependencies / values that are acquired *asynchronously*
// synchronous deps should be loaded with the require function, as per usual,
// but deps and values (such as db values) can and should be loaded via this module
// tests will run in separate processes, but you can use code sharing (not memory sharing) to share setup between tests,
// which is actually pretty cool
// ******************************************************************************************************************

const http = require('http');

/////////////////////////////////////////////////////////////

module.exports = data => {  //load async deps for any of your suman tests

  return {

    dependencies: {

      'Broker': function () {
        return import('../../dist/broker').then(v => v.default || v);
      },

      'LvMtxClient': function(){
        return import('../../dist/client').then(v => v.default || v);
      },

      'Client': function () {
        return import('../../dist/client').then(v => v.default || v);
      },

      'lmUtils': function () {
        return import('../../dist/utils')
      },

      'Promise': function () {
        return require('bluebird');

      }

    }

  }

};
