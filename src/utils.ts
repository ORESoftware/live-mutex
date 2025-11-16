'use strict';

//core
import * as cp from 'child_process';
import * as fs from 'fs';

//npm
import * as ping from 'tcp-ping';

//project
import {Broker1} from './broker-1';
import {EVCb, inspectError} from "./shared-internal";
import * as path from 'path';
import { fileURLToPath } from 'url';

// Resolve path for both CommonJS and ESM
// Use a function to avoid import.meta being parsed in CommonJS builds
function resolveLaunchBrokerPath(): string {
    // @ts-ignore - require may not exist in ESM
    if (typeof require !== 'undefined' && typeof require.resolve === 'function') {
        // CommonJS
        // @ts-ignore
        return require.resolve('./launch-broker-child');
    }
    
    // ESM path - try multiple fallbacks to avoid import.meta parsing issues with ts-node
    // @ts-ignore - __dirname may not exist in ESM
    if (typeof __dirname !== 'undefined') {
        // CommonJS fallback (for ts-node running in CommonJS mode)
        return path.resolve(__dirname, 'launch-broker-child.js');
    }
    
    // Try to use import.meta.url for ESM (only works in actual ESM, not ts-node CommonJS)
    try {
        // Use eval to avoid parsing import.meta at compile time when running with ts-node
        // @ts-ignore
        const importMeta = eval('typeof import !== "undefined" ? import.meta : undefined');
        if (importMeta && importMeta.url) {
            const filePath = fileURLToPath(importMeta.url);
            const dir = path.dirname(filePath);
            return path.resolve(dir, 'launch-broker-child.js');
        }
    } catch (e) {
        // import.meta not available
    }
    
    // Last resort - relative to current working directory or src directory
    const cwd = process.cwd();
    const srcPath = path.resolve(cwd, 'src', 'launch-broker-child.js');
    if (fs.existsSync(srcPath)) {
        return srcPath;
    }
    return path.resolve(cwd, 'dist', 'launch-broker-child.js');
}
const p = resolveLaunchBrokerPath();

const log = {
  info: console.log.bind(console, 'lmx utils:'),
  error: console.error.bind(console, 'lmx utils:')
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
    
    return new Broker1({host: host, port: port})
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
