"use strict";
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module);
Test.create(['Client', 'Broker', 'lmUtils', function (b, assert, before, describe, it, inject, $core, $deps) {
        var _a = b.ioc, Client = _a.Client, Broker = _a.Broker, lmUtils = _a.lmUtils;
        var cp = $core.child_process, fs = $core.fs, path = $core.path;
        var async = $deps.async;
        var multi_process_port = 3018;
        // you must MANUALLY launch the broker on port 3018
        process.setMaxListeners(1000);
        process.stderr.setMaxListeners(1000);
        process.stdout.setMaxListeners(1000);
        var p = path.resolve(__dirname + '/../../fixtures/run-in-child-process.js');
        it.cb('do things', { timeout: 50000 }, function (t) {
            async.times(5, function (n, cb) {
                var k = cp.spawn('node', [p], {
                    env: Object.assign({}, process.env, {
                        multi_process_port: multi_process_port
                    })
                });
                k.stderr.setEncoding('utf8');
                k.stderr.pipe(process.stderr);
                k.once('exit', function (code) {
                    cb(code, { code: code });
                });
            }, function (err, result) {
                if (result) {
                    console.log('the result:', result);
                }
                t.done(err);
            });
        });
    }]);
