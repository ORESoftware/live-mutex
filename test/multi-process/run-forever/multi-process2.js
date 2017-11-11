const cp = require('child_process');
const path = require('path');
const async = require('async');
const {Broker} = require('live-mutex/broker');
const colors = require('chalk');
const util = require('util');
const Handlebars = require('handlebars');
const fs = require('fs');

//////////////////////////////////////////

const source = fs.readFileSync(path.resolve(__dirname + '/../../fixtures/d3-multi-line-plot.html'));
const template = Handlebars.compile(String(source));
const p = path.resolve(__dirname + '/../../fixtures/run-in-child-process.js');

//////////////////////////////////////////////////////////////////

const multi_process_port = 3009;
process.stderr.setMaxListeners(20);

//////////////////////////////////////////////////////////////////

const plotData = {
  rss: [],
  heapTotal: [],
  heapUsed: []
};

let firstNow = null;

const interval = setInterval(function () {
  const mem = process.memoryUsage();
  if(!firstNow){
    firstNow = Date.now();
  }
  const now = Date.now() - firstNow;
  plotData.rss.push({x: now, y: mem.rss});
  plotData.heapTotal.push({x: now, y: mem.heapTotal});
  plotData.heapUsed.push({x: now, y: mem.heapUsed});
  console.log(colors.magenta(util.inspect(mem)));
}, 500);

let onFinish = function(){
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

new Broker({port: multi_process_port}).ensure(function () {

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

    process.exit(1);

  });

});










