// note this code is modeled after https://github.com/visionmedia/debug
// but I tend not to trust certain code, so it is re-purposed

//core
const util = require('util');
const assert = require('assert');

//npm
const moment = require('moment');
const colors = require('colors/safe');

//project
const debugEnv = String(process.env.SUMAN_DEBUG).split(',').map(function (item) {
  return (item instanceof RegExp ? item : new RegExp(item));
});

function capitalizeFirstLetter (str) {
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

const noop = function () {};
const useColors = true;

// const fns = {};

function createColoredString (d, foreground, background) {
  return colors[ foreground ][ background ][ 'bold' ](d);
}

function findMatch (str) {
  for (var i = 0; i < debugEnv.length; i++) {
    var m;
    if (m = String(str).match(debugEnv[ i ])) {
      return true;
    }
  }
  return false;
}

function createDebuggerFn (str, opts) {

  opts = opts || {};

  const timemask = opts.timemask || opts.tm || 'HH:mm:ss:ms a';
  assert(typeof timemask === 'string', '"timemask"/"tm" property passed to suman-debug must be a string.');

  const foreground = opts.fg || opts.foreground || 'magenta';
  var background = opts.bg || opts.background || 'black';

  if (background) {
    if (!String(background).startsWith('bg')) {
      background = 'bg' + capitalizeFirstLetter(background);
    }
  }

  assert(availableColors.indexOf(foreground) > -1, ' => Color chosen is not available => ' + foreground);
  assert(availableColors.indexOf(background) > -1, ' => Color chosen is not available => ' + background);

  var fn, m;

  // if(fn = fns[str]){
  //   return fn;
  // }
  if (!findMatch(str)) {
    return noop;
  }
  else {
    fn = function () {

      const args = Array.prototype.slice.call(arguments);
      const data = args.map(function (a) {

        const d = (typeof a === 'string' ? a : util.inspect(a));
        if (useColors) {
          return createColoredString(d, foreground, background);
        }
        else {
          return d;
        }

      }).join('\n------------------------------------------------------------------------\n');

      process.stderr.write('\n\n' + colors.blue('SUMAN_DEBUG=') + '"' + colors.blue.bold(str) + '"' + ' @'
        + colors.cyan.bold(moment().format(timemask)) + '\n' + data + '\n\n');
    };

    // fns[str] = fn;
    return fn;
  }

}

module.exports = createDebuggerFn;