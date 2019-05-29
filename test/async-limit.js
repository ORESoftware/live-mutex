

const async = require('async');
const cp = require('child_process');

// async.timesLimit(1000, 50, function(n, cb){
//
//   console.log('processing:', n);
//
//   if(n === 100 && false){
//     return;
//   }
//
//   process.nextTick(cb);
//
//
// }, function(err){
//
//    if(err) throw err;
//
//    console.log('all done.');
//
// });

const k = cp.spawn('bash');
const {JSONParser} = require('@oresoftware/json-stream-parser');

k.stdout.pipe(new JSONParser()).on('data', d => {
  console.log('data:', d);
});

k.stdin.write(`
   echo '{"foo":"bar","zoom":5}'
   echo '{"foo":"bar"}'
   echo '{"foo":"bar"}'
`);

k.kill(9);
