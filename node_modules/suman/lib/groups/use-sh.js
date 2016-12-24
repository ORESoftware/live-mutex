'use striiiict';

//core
const path = require('path');
const cp = require('child_process');
const fs = require('fs');
const domain = require('domain');
const assert = require('assert');
const util = require('util');

//npm
const async = require('async');
const colors = require('colors/safe');

////////////////////////////////////////////////////////////////////////////

module.exports = function useContainer(strm, item, cb) {

  //TODO: maybe container does not need to be re-built

  if(item.script){

    //TODO: could use execSync to find $SHELL, like so cp.execSync('echo $SHELL');

    var exec = 'bash';
    if(typeof item.script === 'object'){
       exec = item.script.interpreter || exec;
       item.script = item.script.str;
    }

    assert(typeof item.script === 'string',
      ' => suman.group item has script property which does not point to a string => ' + util.inspect(item));

    var n = cp.spawn(exec, [],{
      cwd: item.cwd || process.cwd()
    });

    n.stdin.setEncoding('utf8');
    n.stderr.setEncoding('utf8');
    n.stdout.setEncoding('utf8');

    n.stdin.write('\n' + item.script + '\n');   // <<< key part, you must use newline char

    process.nextTick(function(){
      n.stdin.end();
    });


    if(!global.sumanOpts.no_stream_to_console){
      n.stdout.pipe(process.stdout, {end: false});
      n.stderr.pipe(process.stderr, {end: false});
    }

    if(!global.sumanOpts.no_stream_to_file){
      n.stdout.pipe(strm, {end: false});
      n.stderr.pipe(strm, {end: false});
    }


    n.on('close', function (code) {
      cb(null,{
        code: code,
        name: item.name
      });
    });

  }
  else if(typeof item.getPathToScript === 'function'){

    const b = item.getPathToScript();
    assert(path.isAbsolute(b), ' => Path to group script must be absolute.');


    console.log(colors.red.bold('path to script => ', b));

    var n = cp.spawn(b, [], {
      // stdio: ['ignore','inherit','inherit']
      cwd: item.cwd || process.cwd()
    });


    n.stdin.setEncoding('utf8');
    n.stderr.setEncoding('utf8');
    n.stdout.setEncoding('utf8');

    if(!global.sumanOpts.no_stream_to_console){
      n.stdout.pipe(process.stdout, {end: false});
      n.stderr.pipe(process.stderr, {end: false});
    }

    if(!global.sumanOpts.no_stream_to_file){
      n.stdout.pipe(strm, {end: false});
      n.stderr.pipe(strm, {end: false});
    }


    n.on('close', function (code) {
      cb(null, {
         code: code,
         name: item.name
      });
    });

  }
  else{
    throw new Error(' => Suman usage error => You do not have the necessary properties on your suman.group item.\n' +
      'Please see xxx.');
  }


};
