import suman = require('suman');
const Test = suman.init(module);

Test.create(function (assert, before, describe, it, Client, Broker, lmUtils, inject, $core, $deps) {

  const {child_process, fs, path} = $core;
  const {async} = $deps;

  const multi_process_port = 3009;

  before.skip.cb(h => {

    lmUtils.conditionallyLaunchSocketServer({port: multi_process_port}, function (err) {

      if (err) {
        throw err;
      }

      console.log('live-mutex server launched.');

      h.done();

    });

  });

  before(h => {
    return new Broker({port: multi_process_port}).ensure();
  });

  it.cb('launches several processes', t => {

    const p = path.resolve(__dirname + '/../fixtures/run-in-child-process.js');

    async.times(1, function (n, cb) {

      const k = child_process.spawn('node', [p], {
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

      if (result && result.stderr) {
        console.log(result.stderr);
      }

      t.done(err);

    });

  });

});
