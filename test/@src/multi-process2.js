const async = require('async');
const {Broker} = require('live-mutex/broker');
const cp = require('child_process');
const path = require('path');

const multi_process_port = 3009;

new Broker({port: multi_process_port}).ensure().then(function () {

  const p = path.resolve(__dirname + '/../fixtures/run-in-child-process.js');

  async.times(13, function (n, cb) {

    const k = cp.spawn('node', [p], {
      env: Object.assign({}, process.env, {
        multi_process_port
      })
    });

    let data = '';
    k.stderr.setEncoding('utf8');

    k.stderr.on('data', function (d) {
      data += d;
    });

    console.error('stderr => ', data);

    k.stderr.pipe(process.stderr);

    k.once('exit', function (code) {

      console.error('stderr => ', data);

      cb(code, {
        code,
        stderr: data
      });

    });

  }, function (err, result) {

    console.log('arguments', arguments);

    if (result) {
      console.log(result);
    }

  });

});







