

const async = require('async');

async.timesLimit(1000, 50, function(n, cb){

  console.log('processing:', n);

  if(n === 100 && false){
    return;
  }

  process.nextTick(cb);


}, function(err){

   if(err) throw err;

   console.log('all done.');

});