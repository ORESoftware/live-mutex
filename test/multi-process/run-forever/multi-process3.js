'use strict';

const cp = require('child_process');
const path = require('path');
const async = require('async');
const {Broker} = require('live-mutex');
const util = require('util');
const colors = require('chalk');
const fs = require('fs');
const Handlebars = require('handlebars');   //  you need to npm link  "handlebars": "^4.0.10",

////////////////////////////////////////////////////////////////

const source = fs.readFileSync(path.resolve(__dirname + '/../../fixtures/d3-multi-line-plot.html'));
const template = Handlebars.compile(String(source));

//////////////////////////////////////////////////////////////////

const multi_process_port = 3019;
process.stderr.setMaxListeners(40);

const plotData = {
  rss: [],
  heapTotal: [],
  heapUsed: []
};

let firstNow = null;
const interval = setInterval(function () {
  const mem = process.memoryUsage();
  if (!firstNow) {
    firstNow = Date.now();
  }
  const now = Date.now() - firstNow;
  plotData.rss.push({x: now, y: mem.rss});
  plotData.heapTotal.push({x: now, y: mem.heapTotal});
  plotData.heapUsed.push({x: now, y: mem.heapUsed});
  console.log(colors.magenta(util.inspect(mem)));
}, 500);

let onFinish = function () {
  clearInterval(interval);
  plotData.rss = JSON.stringify(plotData.rss);
  plotData.heapTotal = JSON.stringify(plotData.heapTotal);
  plotData.heapUsed = JSON.stringify(plotData.heapUsed);

  const htmlResult = template(plotData);
  let p = path.resolve(__dirname + '/../../fixtures/d3-multi-line-plot-output.html');
  fs.writeFileSync(p, htmlResult);
  console.log('all done writing file.');
  process.exit(0);
};

process.once('SIGINT', onFinish);
setTimeout(onFinish, 1000000);

new Broker({port: multi_process_port}).ensure(function (err, b) {

  b.emitter.on('warning', w => {
    console.error('broker warning:',w );
  });

  b.emitter.on('error', e => {
    console.error('broker error:', e);
    process.exit(1);
  });

  const p = path.resolve(__dirname + '/../../fixtures/run-multiple-clients-in-sep-process.js');

  async.timesLimit(15, 8, function (n, cb) {

    const k = cp.spawn('node', [p], {
      env: Object.assign({}, process.env, {
        multi_process_port
      })
    });


    k.stderr.setEncoding('utf8');
    k.stderr.pipe(process.stderr);

    k.once('exit', function (code) {

      if(code > 0){
        console.error(colors.red('child process exitted with code'), code);
      }

      cb(code, {code});
    });

  }, function (err, result) {

    if(err){
      throw err;
    }

    if (result) {
      console.log(result);
    }

    process.exit(0);

  });

});











