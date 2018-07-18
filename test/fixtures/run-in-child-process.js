'use strict';


const {Client} = require('live-mutex');
const async = require('async');
const chalk = require('chalk');

let times = 10;
let keys = [];

for (let i = 0; i < times; i++) {
  keys.push(String(i));
}

let min = 5;
let max = 11900;


process.on('warning', function (e) {
  console.error(e.stack || e);
});

const port = parseInt(process.env.multi_process_port);

const client = new Client({port}, function (err, c) {

  if (err) {
    throw err;
  }

  c.emitter.on('warning', function (v) {
    console.error('client warning',...arguments);
  });

  c.emitter.on('error', function (v) {
    console.error('client error',...arguments);
  });


  async.timesLimit(10000, 140, function (n, cb) {

    let randomKey = keys[Math.floor(Math.random() * keys.length)];
    console.log('count', n, 'randomKey', randomKey);

    client.lock(randomKey, function (err, unlock) {

      if (err && String(err.stack || err.message || err).match(/lock request timed out/ig)) {
        console.error(chalk.red('lock request timed out for key:'), randomKey);
        return cb(null);
      }

      if(err){
        console.error('this is bad news fml.');
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
      process.exit(1);
    }
    else {
      process.exit(0);
    }

  });

});



