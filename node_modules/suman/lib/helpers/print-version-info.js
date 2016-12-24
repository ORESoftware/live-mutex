'use striiiict';

//core
const util = require('util');

//npm
const colors = require('colors/safe');

//project
const ascii = require('./ascii');

////////////////////////////////////////////////

// this file should only run once by design

///////////////////////////////////////////////

const cwd = process.cwd();
const pkgJSON = require('../../package.json');
const v = pkgJSON.version;
console.log(' => Node.js version =>', process.version);
console.log(colors.gray.italic(' => Suman v' + v + ' running individual test suite...'));
console.log(' => cwd: ' + cwd);
console.log(ascii.suman_slant, '\n');
