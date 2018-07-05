'use strict';


const {Client} = require('live-mutex');
const async = require('async');


let times = 10;
let keys = [];

for (let i = 0; i < times; i++) {
  keys.push(String(i));
}

let min = 5;
let max = 1100;

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

    clients.forEach(c => {

      c.emitter.on('warning', function (v) {
        console.error('client warning',...arguments);
      });

      c.emitter.on('error', function (v) {
        console.error('client error',...arguments);
      });

    });

    async.timesLimit(1000, 4, function (n, cb) {
      
      let randomKey = keys[Math.floor(Math.random() * keys.length)];
      let randomClient = clients[Math.floor(Math.random() * clients.length)];
      
      randomClient.lock(randomKey, {max: 1},function (err, unlock) {
        
        if (err && String(err.message || err).match(/lock request timed out/)) {
          return cb(null);
        }

         if (err) {
          return cb(err);
        }
        
        let randomTime = Math.round(Math.random() * (max - min)) + min;

        setTimeout(function () {
          unlock(cb);
        }, randomTime)
        
      });
      
    }, function (err) {
      
      if (err) {
        console.error(err.stack || err);
        return process.exit(1);
      }
      
      process.exit(0);
      
    });
    
  });







