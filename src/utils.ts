'use strict';

//core
import * as cp from 'child_process';

//npm
import ping = require('tcp-ping');

//project
import {Broker} from './broker';
const p = require.resolve('./launch-broker-child');

const log = {
  info: console.log.bind(console, 'lmx utils:'),
  error: console.error.bind(console, 'lmx utils:')
};

export type EVCb<T, E = any> = (err: E, val: T) => void


export const once = function (ctx: any, fn: Function) {
  let callable = true;
  return function (err: any) {
    if (callable) {
      callable = false;
      return fn.apply(ctx === 'that' ? this : ctx, arguments);
    }
    else if (err) {
      log.error(err.stack || err.message || err);
    }
  }
};

export const launchSocketServer = function (opts: any, cb: EVCb<any>) {
  
  const host = opts.host || 'localhost';
  const port = opts.port || 6970;
  
  ping.probe(host, port, function (err, available) {
    
    if (err) {
      return cb(err, {});
    }
    
    if (available) {
      return cb(null, 'available');
    }
    
    return new Broker({host: host, port: port})
    .ensure(cb as any);
    
  });
  
};

export const launchSocketServerp = function (opts: any): Promise<any> {
  return new Promise((resolve, reject) => {
    launchSocketServer(opts, function (err, val) {
      err ? reject(err) : resolve(val);
    });
  });
};

// alias
export const conditionallyLaunchSocketServer = launchSocketServer;
export const conditionallyLaunchSocketServerp = launchSocketServerp;

export const launchBrokerInChildProcess = function (opts: any, cb: EVCb<any>) {
  
  const host = opts.host || 'localhost';
  const port = opts.port || 8019;
  const detached = Boolean(opts.detached);
  
  ping.probe(host, port, function (err, available) {
    
    if (err) {
      return cb(err, {})
    }
    
    if (available) {
      log.info(`live-mutex broker/server was already live at ${host}:${port}.`);
      return cb(null, {host, port, alreadyRunning: true});
    }
    
    log.info(`live-mutex is launching new broker at '${host}:${port}'.`);
    
    const n = cp.spawn('node', [p], {
      detached,
      env: Object.assign({}, process.env, {
        LIVE_MUTEX_PORT: port
      })
    });
    
    if (detached) {
      n.unref();
    }
    
    process.once('exit', function () {
      if (!detached) {
        n.kill('SIGINT');
      }
    });
    
    n.stderr.setEncoding('utf8');
    n.stdout.setEncoding('utf8');
    n.stderr.pipe(process.stderr);
    n.stdout.pipe(process.stdout);
    
    let stdout = '';
    n.stdout.on('data', function (d) {
      
      stdout += String(d);
      
      if (stdout.match(/live-mutex broker is listening/i)) {
        
        n.stdout.removeAllListeners();
        
        if (detached) {
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
  });
  
};

export const launchBrokerInChildProcessp = function (opts: any): Promise<any> {
  return new Promise((resolve, reject) => {
    launchBrokerInChildProcess(opts, (err, val) => {
      err ? reject(err) : resolve(val);
    })
  });
};