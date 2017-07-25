// import suman = require('suman');
// import async = require('async');
//
// const Test = suman.init(module);
//
// Test.create(function (assert, before, describe, it, path, Client, Broker, lmUtils, fs, inject) {
//
//
//   lmUtils.conditionallyLaunchSocketServer({port: 3060}, function (err) {
//
//     if (err) {
//       throw err;
//     }
//
//     console.log('live-mutex server launched.');
//
//   });
//
// });
const lmUtils = require('live-mutex/utils');

lmUtils.conditionallyLaunchSocketServer({port: 3060}, function (err) {

  if (err) {
    throw err;
  }

  console.log('live-mutex server launched.');

});