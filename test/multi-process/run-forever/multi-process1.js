const cp = require('child_process');
const path = require('path');
const async = require('async');
const {Broker} = require('live-mutex/broker');
const colors = require('chalk');

//////////////////////////////////////////////////////////////////

const multi_process_port = 3009;

//////////////////////////////////////////////////////////////////

setInterval(function(){
  console.log(colors.magenta(util.inspect(process.memoryUsage())));
}, 5000);

new Broker({port: multi_process_port}).ensure(function () {

  const p = path.resolve(__dirname + '/../../fixtures/run-in-child-process.js');

  async.times(1, function (n, cb) {

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

    k.stderr.pipe(process.stdout);
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

    if (result && result.stderr) {
      console.error('\n');
      console.error('stderr from child:')
      console.error(result.stderr);
    }

    process.exit(1);

  });

});






