#!/usr/bin/env node
'use strict';

//core
import path = require('path');
import fs = require('fs');

//project
const cwd = process.cwd();
const down = [];
let exec, found = false;
const execNameIndex = process.argv.indexOf('--exec-name');

if(execNameIndex < 0){
  exec = 'suman/dist/cli.js';
}
else{
  exec = '.bin/' + process.argv[execNameIndex + 1];
}

try{
  fs.mkdirSync(path.resolve(process.env.HOME + '/.suman'));
}
catch(err){
 // ignore
}

let p, cd;

const stat = function  (p: string) {
  try {
    return fs.lstatSync(p).isFile();
  }
  catch (err) {
    if (!String(err.stack || err).match(/ENOENT: no such file or directory/i)) {
      throw err;
    }
    //explicit for your pleasure
    return false;
  }
};

while (true) {

  cd = path.resolve(cwd + down.join(''));

  if (String(cd) === String(path.sep)) {
    // We are down to the root => fail
    break;
  }

  p = path.resolve(cd + '/node_modules/' + exec);

  if (stat(p)) {
    // Found Suman installation path
    found = true;
    break;
  }

  down.push('/../');

}

if (found) {
  console.log(p);
  process.exit(0);
}
else {
  process.exit(1);
}
