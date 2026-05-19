'use strict';

//polyfills
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');

//core
const util = require('util');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

//npm
const colors = require('colors/safe');

//project
const debugEnv = String(process.env.SUMAN_DEBUG).split(',').map(function (item) {
  return (item instanceof RegExp ? item : new RegExp(item));
});

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const availableColors = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  'grey',
  'background colors',
  'bgBlack',
  'bgRed',
  'bgGreen',
  'bgYellow',
  'bgBlue',
  'bgMagenta',
  'bgCyan',
  'bgWhite'
];

const alwaysReturnsTrue = function () {
  return true;
};

const noop = function (list, predicate) {

  const sumanOpts = (global.sumanOpts || {});

  //TODO: we should compared global.sumanOpts with the opts passed in
  // if(Array.isArray(list)){
  //     if(opts && ((opts.verbose && sumanOpts.verbose) || (opts.vverbose && sumanOpts.vverbose))){
  //         console.log.apply(console, list);
  //     }
  // }

  if (Array.isArray(list)) {
    if (predicate && predicate() || (!predicate && sumanOpts.vverbose)) {
      console.log.apply(console, list);
    }
  }

};

let useColors = true;

function createColoredString(d, foreground, background) {
  let item = colors;
  if (foreground) {
    item = item[foreground]
  }
  if (background) {
    item = item[background]
  }
  if (true || bold) {
    item = item.bold
  }

  return item(d);
}

function findMatch(str) {
  for (let i = 0; i < debugEnv.length; i++) {
    let m;
    if (m = String(str).match(debugEnv[i])) {
      return true;
    }
  }
  return false;
}

function createDebuggerFn(str, opts) {

  assert(typeof str === 'string',
    ' => suman-debug project => usage error => please pass a string identifier as first arg.');
  opts = opts || {};
  // opts.vverbose = true;

  const timemask = opts.timemask || opts.tm || 'HH:mm:ss:ms a';
  assert(typeof timemask === 'string', '"timemask"/"tm" property passed to suman-debug must be a string.');

  const foreground = opts.fg || opts.foreground || 'cyan';
  // let  background = opts.bg || opts.background || 'bgWhite';
  let background = opts.bg || opts.background;
  let lfp = opts.lfp || opts.logFilePath || path.resolve(process.env.HOME + '/.suman/suman-debug.log');

  assert(path.isAbsolute(lfp), ' => suman-debug project => log file path is not absolute => ' + lfp);

  if (foreground) {
    assert(availableColors.indexOf(foreground) > -1, ' => Color chosen is not available => ' + foreground);
  }

  if (background) {
    if (!String(background).startsWith('bg')) {
      background = 'bg' + capitalizeFirstLetter(background);
    }
    assert(availableColors.indexOf(background) > -1, ' => Color chosen is not available => ' + background);
  }

  let fn, m;

  if (!findMatch(str) && !opts.force) {
    return noop;
  }
  else {
    fn = function (list, predicate) {

      if (Array.isArray(list)) {
        predicate = predicate || alwaysReturnsTrue;
      }
      else {
        list = Array.prototype.slice.call(arguments);
        opts = null;
      }

      try {
        fs.writeFileSync(lfp,
          ' => Beginning of debugging output on ' + new Date() + ', via SUMAN_DEBUG=' + str,
          {flag: 'wx', flags: 'wx'});
      }
      catch (err) {
        if (!String(err.stack || err).match(/EEXIST/i)) {
          console.error(' => suman-debug project =>  could not log debug data to log file => ',
            '\n', (err.stack || err));
        }
      }

      const data = list.map(function (a) {

        const d = (typeof a === 'string' ? a : util.inspect(a));

        fs.writeFileSync(lfp, '\n' + d + '\n', {flags: 'a', flag: 'a'});

        if (useColors) {
          return createColoredString(d, foreground, background);
        }
        else {
          return d;
        }

      }).join('\n------------------------------------------------------------------------\n');

      process.stderr.write('\n\n' + colors.blue('SUMAN_DEBUG=') + '"' + colors.blue.bold(str) + '"' + ' @'
        + colors.cyan.bold(new Date()) + '\n' + data + '\n\n');

    };

    return fn;
  }

}

module.exports = createDebuggerFn;