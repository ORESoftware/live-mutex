'use strict';
import suman = require('suman');
const Test = suman.init(module);

////////////////////////////////////////////////

Test.create(function (assert, before, describe, it, Client, Broker, lmUtils, inject, $core, $deps) {

  const {child_process: cp, fs, path} = $core;
  const {async, chalk:colors} = $deps;

  const multi_process_port = 3019;
  process.stderr.setMaxListeners(40);

  it.cb('all', t => {

    new Broker({port: multi_process_port}).ensure(function () {

      const p = path.resolve(__dirname + '/../fixtures/run-multiple-clients-in-sep-process.js');

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

        console.log('arguments', arguments);

        if (result) {
          console.log(result);
        }

        t.done(err);

      });

    });

  });

});










