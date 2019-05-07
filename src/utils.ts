'use strict';

//core
import * as cp from 'child_process';

//npm
import ping = require('tcp-ping');

//project
import {Broker} from './broker';
const p = require.resolve('./launch-broker-child');

const log = {
  info: console.log.bind(console, ' [live-mutex utils]'),
  error: console.error.bind(console, ' [live-mutex utils]')
};

export type EVCb<T> = (err: any, val?: T) => void

//////////////////////////////////////////////////////////////////////////////////////////////////


export const compareVersions = (clientVersion: string, brokerVersion: string) => {
  
  if(!(clientVersion && typeof clientVersion === 'string')){
    throw new Error(`The client version is not defined as string: ${clientVersion}`);
  }
  
  if(!(brokerVersion && typeof brokerVersion === 'string')){
    throw new Error(`The broker version is not defined as string: ${brokerVersion}`);
  }

  const [majorA, minorA] = clientVersion.split('.');
  const [majorB, minorB] = brokerVersion.split('.');

  if(majorA !== majorB){
    throw `Major versions are different - client version:${clientVersion}, server version:${brokerVersion}`;
  }

  const minorAInt = Number.parseInt(minorA.charAt(0));
  const minorBInt = Number.parseInt(minorB.charAt(0));

  if(Math.abs(minorAInt - minorBInt) > 0){
    throw `Minor versions are different - client version:${clientVersion}, server version:${brokerVersion}`;
  }

};



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
      return cb(err);
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
      return cb(err)
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