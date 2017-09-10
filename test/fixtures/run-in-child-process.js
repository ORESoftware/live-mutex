const {Client} = require('live-mutex/client');

const async = require('async');
const uuidv4 = require('uuid/v4');

let times = 10;
let keys = [];

for (let i = 0; i < times; i++) {
  keys.push(String(i));
}

let min = 5;
let max = 4000;

process.on('warning', function (e) {
  console.error(e.stack || e);
});

const port = parseInt(process.env.multi_process_port);

const client = new Client({port}, function (err) {

  if (err) {
    throw err;
  }

  async.timesLimit(100000, 200, function (n, cb) {

    let randomKey = keys[Math.floor(Math.random() * keys.length)];
    console.log('count', n, 'randomKey', randomKey);

    client.lock(randomKey, function (err, unlock) {

      if (err && String(err.message || err).match(/lock request timed out/)) {
        return cb(null);
      }
      else if(err){
        return cb(err);
      }

      let randomTime = Math.round(Math.random() * (max - min)) + min;
      console.error('random time => ', randomTime);

      setTimeout(function () {
        unlock(cb);
      }, randomTime)

    });

  }, function (err) {

    if (err) {
      console.error(err.stack || err);
      process.exit(1);
    }
    else {
      process.exit(0);
    }

  });

});



