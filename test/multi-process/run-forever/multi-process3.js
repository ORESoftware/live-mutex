const cp = require('child_process');
const path = require('path');
const async = require('async');
const {Broker} = require('live-mutex/broker');
const colors = require('chalk');

const multi_process_port = 3019;
process.stderr.setMaxListeners(40);

new Broker({port: multi_process_port}).ensure(function () {

  const p = path.resolve(__dirname + '/../../fixtures/run-multiple-clients-in-sep-process.js');

  async.times(15, function (n, cb) {

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

    k.stderr.pipe(process.stderr);

    k.once('exit', function (code) {

      console.error(colors.red('child process exitted with code'), code);

      if (data) {
        console.error('stderr => ', data);
      }

      cb(code, {
        code,
        stderr: data
      });

    });

  }, function (err, result) {

    console.log('\narguments:', arguments);

    if (result) {
      console.log(result);
    }

    process.exit(1);

  });

});











