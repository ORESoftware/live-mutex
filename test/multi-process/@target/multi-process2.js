var suman = require('suman');
var Test = suman.init(module);
Test.create(function (assert, before, describe, it, Client, Broker, lmUtils, inject, $core, $deps) {
    var cp = $core.child_process, fs = $core.fs, path = $core.path;
    var async = $deps.async;
    var multi_process_port = 3018;
    new Broker({ port: multi_process_port }).ensure().then(function () {
        var p = path.resolve(__dirname + '/../fixtures/run-in-child-process.js');
        async.times(13, function (n, cb) {
            var k = cp.spawn('node', [p], {
                env: Object.assign({}, process.env, {
                    multi_process_port: multi_process_port
                })
            });
            var data = '';
            k.stderr.setEncoding('utf8');
            k.stderr.on('data', function (d) {
                data += d;
            });
            console.error('stderr => ', data);
            k.stderr.pipe(process.stderr);
            k.once('exit', function (code) {
                console.error('stderr => ', data);
                cb(code, {
                    code: code,
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
});
