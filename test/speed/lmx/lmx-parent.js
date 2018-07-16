'use strict';

const path = require('path');
const async = require('async');
const cp = require('child_process');
const {Broker} = require('live-mutex');
const b = new Broker({udsPath: path.resolve(process.env.HOME + '/.ore/z.unix.lock')});

b.emitter.on('warning', function () {
  console.log(...arguments);
});

b.start().then(function(){

  const start = Date.now();

  async.times(8, function (num, cb) {

    const k = cp.spawn('node', [path.resolve(__dirname + '/lmx-child.js')], {
      env: Object.assign({}, process.env, {
        lmx_num: num
      })
    });
    k.stderr.pipe(process.stderr);
    k.once('exit', cb);

  }, function (err) {

    if (err) {
      throw err;
    }

    console.log('total time:', Date.now() - start);
    process.exit(0);

  });


});



