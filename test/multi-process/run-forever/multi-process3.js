const cp = require('child_process');
const path = require('path');
const async = require('async');
const {Broker} = require('live-mutex/broker');
const util = require('util');
const colors = require('chalk');

const multi_process_port = 3019;
process.stderr.setMaxListeners(40);

let prev = null;
setInterval(function () {
  let mem = process.memoryUsage();
  if(prev){
    const diff = (mem.heapUsed - prev.heapUsed);
    console.log('diff:', diff);
    const diffPercentage = diff / prev.heapUsed;
    console.log('diffPercentage:', diffPercentage);
  }
  console.log(colors.magenta(util.inspect(mem)));
  prev = mem;
}, 2000);

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











