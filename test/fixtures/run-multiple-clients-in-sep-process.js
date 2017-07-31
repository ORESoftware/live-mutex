const {Client} = require('live-mutex/client');

const async = require('async');
const uuidv4 = require('uuid/v4');

let times = 10;
let keys = [];

for (let i = 0; i < times; i++) {
  keys.push(String(i));
}

let min = 5;
let max = 100;

process.on('warning', function (e) {
  console.error(e.stack || e);
});

const port = parseInt(process.env.multi_process_port);

Promise.all([
  new Client({port}).ensure(),
  new Client({port}).ensure(),
  new Client({port}).ensure(),
  new Client({port}).ensure(),
  new Client({port}).ensure()
])
.then(function (clients) {

  async.timesLimit(100000, 200, function (n, cb) {

    let randomKey = keys[Math.floor(Math.random() * keys.length)];
    let randomClient = clients[Math.floor(Math.random() * clients.length)];

    // console.error('count => ', n);

    randomClient.lock(randomKey, function (err, unlock) {

      if (err && String(err.message || err).match(/lock request timed out/)) {
        return cb(null);
      }
      else if(err){
        return cb(err);
      }

      let randomTime = Math.round(Math.random() * (max - min)) + min;

      // console.error('randomTime => ', randomTime);

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







