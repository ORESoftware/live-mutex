

const path = require('path');
const async = require('async');
const lf = require('lockfile');
const cp = require('child_process');

const start = Date.now();

async.times(8, function(num, cb){

  const k = cp.spawn('node',[path.resolve(__dirname + '/lf-child.js')]);
  k.stderr.pipe(process.stderr);
  k.once('exit', cb);

}, function(err){

  if(err){
    throw err;
  }


  console.log('total time:', Date.now()- start);
  process.exit(0);


});