'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var cp = require("child_process");
var ping = require('tcp-ping');
var slp = require('strangeloop');
var ijson = require('siamese');
var broker_1 = require("./broker");
var p = require.resolve('./lib/launch-broker-child');
exports.once = function (ctx, fn) {
    var callable = true;
    return function () {
        if (callable) {
            callable = false;
            return fn.apply(ctx === 'that' ? this : ctx, arguments);
        }
    };
};
exports.launchSocketServer = function (obj, cb) {
    if (typeof obj === 'function') {
        cb = obj;
        obj = {};
    }
    obj = obj || {};
    var host = obj.host || 'localhost';
    var port = obj.port || 6970;
    function fn(cb) {
        ping.probe(host, port, function (err, available) {
            if (err) {
                cb(err);
            }
            else if (available) {
                cb(null, 'available');
            }
            else {
                new broker_1.Broker({
                    host: host,
                    port: port
                })
                    .ensure(cb);
            }
        });
    }
    return slp.conditionalReturn(fn, cb);
};
exports.conditionallyLaunchSocketServer = exports.launchSocketServer;
exports.launchBrokerInChildProcess = function (opts, cb) {
    var host = opts.host || 'localhost';
    var port = opts.port || 8019;
    var detached = !!opts.detached;
    console.log('\n');
    console.log('Live-Mutex launch broker options:');
    console.log('host => ', host);
    console.log('port => ', port);
    console.log('detached => ', detached);
    console.log('\n');
    function fn(cb) {
        ping.probe(host, port, function (err, available) {
            if (err) {
                cb(err);
            }
            else if (available) {
                console.log("live-mutex brower was already live at " + host + ":" + port + ".");
                cb(null, {
                    alreadyRunning: true
                });
            }
            else {
                console.log("live-mutex is launching new broker at " + 'localhost' + ":" + port + ".");
                var n_1 = cp.spawn('node', [p], {
                    detached: detached,
                    env: Object.assign({}, process.env, {
                        LIVE_MUTEX_PORT: port
                    })
                });
                if (detached) {
                    n_1.unref();
                }
                process.once('exit', function () {
                    if (!detached) {
                        n_1.kill('SIGINT');
                    }
                });
                n_1.stderr.setEncoding('utf8');
                n_1.stdout.setEncoding('utf8');
                n_1.stderr.pipe(process.stderr);
                var data_1 = '';
                n_1.stdout.on('data', function (d) {
                    console.log('stdout => ', d);
                    data_1 += d;
                    if (String(data_1).match(/live-mutex broker is listening/)) {
                        console.log('matched');
                        n_1.stdout.removeAllListeners();
                        if (detached) {
                            n_1.unref();
                        }
                        cb(null, n_1);
                    }
                });
            }
        });
    }
    return slp.conditionalReturn(fn, cb);
};
var $exports = module.exports;
exports.default = $exports;
