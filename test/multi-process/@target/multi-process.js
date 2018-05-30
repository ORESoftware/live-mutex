"use strict";
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module);
Test.create(['Broker', 'Client', 'lmUtils', function (b, assert, before, describe, it, inject, $core, $deps) {
        var _a = b.ioc, Client = _a.Client, Broker = _a.Broker, lmUtils = _a.lmUtils;
        var child_process = $core.child_process, fs = $core.fs, path = $core.path;
        var async = $deps.async;
        var multi_process_port = 3018;
        // you should launch a broker MANUALLY
        // before(h => {
        //   return new Broker({port: multi_process_port}).ensure();
        // });
        it.cb('launches several processes', { timeout: 50000 }, function (t) {
            var p = path.resolve(__dirname + '/../../fixtures/run-in-child-process.js');
            async.times(1, function (n, cb) {
                var k = child_process.spawn('node', [p], {
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
                if (result && result.stderr) {
                    console.log(result.stderr);
                }
                t.done(err);
            });
        });
    }]);
