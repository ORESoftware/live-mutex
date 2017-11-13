'use strict';

//core
import * as util from 'util';
import * as path from 'path';
import * as assert from 'assert';
import * as EE from 'events';
import * as cp from 'child_process';

//npm
const ping = require('tcp-ping');
const slp = require('strangeloop');

//project
import {Broker} from './broker';
const p = require.resolve('./lib/launch-broker-child');


//////////////////////////////////////////////////////////////////////////////////////////////////

export const once = function (ctx, fn: Function) {
  let callable = true;
  return function () {
    if (callable) {
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

  return slp.conditionalReturn(fn, cb);
};

// alias
export const conditionallyLaunchSocketServer = launchSocketServer;

export const launchBrokerInChildProcess = function (opts, cb) {

  const host = opts.host || 'localhost';
  const port = opts.port || 8019;
  const detached = Boolean(opts.detached);

  function fn(cb) {

    ping.probe(host, port, function (err, available) {

      if (err) {
         cb(err)
      }
      else if (available) {
        console.log(`live-mutex brower was already live at ${host}:${port}.`);
        cb(null, {
          host,
          port,
          alreadyRunning: true
        });
      }
      else {

        console.log(`live-mutex is launching new broker at '${host}:${port}'.`);

        const n = cp.spawn('node', [p], {
          detached,
          env: Object.assign({}, process.env, {
            LIVE_MUTEX_PORT: port
          })
        });

        if(detached){
          n.unref();
        }

        process.once('exit', function(){
          if(!detached){
            n.kill('SIGINT');
          }
        });

        n.stderr.setEncoding('utf8');
        n.stdout.setEncoding('utf8');

        n.stderr.pipe(process.stderr);

        let stdout = '';
        n.stdout.on('data', function (d) {

          stdout += String(d);

          if (stdout.match(/live-mutex broker is listening/i)) {

            n.stdout.removeAllListeners();

            if(detached){
              n.unref();
            }

            cb(null, {
              liveMutexProcess: n,
              host,
              port,
              detached
            });
          }
        });

      }

    });

  }

  return slp.conditionalReturn(fn, cb);

};

const $exports = module.exports;
export default $exports;