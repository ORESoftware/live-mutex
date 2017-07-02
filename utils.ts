'use strict';

//core
import * as util from 'util';
import * as path from 'path';
import * as assert from 'assert';
import * as EE from 'events';
import * as cp from 'child_process';

//npm
const ping = require('tcp-ping');
const strangeloop = require('strangeloop');
const ijson = require('siamese');

//project
const Broker = require('./broker');
const p = require.resolve('./lib/launch-broker-child');

//////////////////////////////////////////////////////////////////////////////////////////////////

export const once = function(ctx, fn: Function){
  let callable = true;
  return function(){
    if(callable){
      callable = false;
      return fn.apply(ctx === 'that' ? this : ctx, arguments);
    }
  }
};

export const launchSocketServer = function (obj, cb) {

  if (typeof obj === 'function') {
    cb = obj;
    obj = {};
  }

  obj = obj || {};

  const host = obj.host || 'localhost';
  const port = obj.port || 6970;

  function fn(cb) {
    ping.probe(host, port, function (err, available) {

      if (err) {
        cb(err)
      }
      else if (available) {
        cb(null, 'available');
      }
      else {

        new Broker({
          host: host,
          port: port
        })
        .ensure(cb);
      }

    });
  }

  return strangeloop.conditionalReturn(fn, cb);
};

// alias
export const conditionallyLaunchSockerServer = launchSocketServer;

export const launchBrokerInChildProcess = function (conf, cb) {

  const host = conf.host || 'localhost';
  const port = conf.port || 8019;
  const detached = !!conf.detached;

  function fn(cb) {

    ping.probe(host, port, function (err, available) {

      if (err) {
        cb(err)
      }
      else if (available) {
        cb(null);
      }
      else {

        const n = cp.spawn('node', [p], {
          detached: detached,
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        });

        n.once('message', function (data) {

          n.disconnect();
          n.unref();

          ijson.parse(data).then(function (d) {
            if (d.error) {
              cb(d.error);
            }
            else {
              cb(null);
            }
          })
          .catch(cb);

        });

        n.send({host, port});
      }

    });

  }

  return strangeloop.conditionalReturn(fn, cb);

};


const $exports = module.exports;
export default $exports;