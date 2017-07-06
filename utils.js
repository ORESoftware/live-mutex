'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var cp = require("child_process");
var ping = require('tcp-ping');
var sl = require('strangeloop');
var ijson = require('siamese');
var Broker = require('./broker').Broker;
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
                new Broker({
                    host: host,
                    port: port
                })
                    .ensure(cb);
            }
        });
    }
    return sl.conditionalReturn(fn, cb);
};
exports.conditionallyLaunchSocketServer = exports.launchSocketServer;
exports.launchBrokerInChildProcess = function (conf, cb) {
    var host = conf.host || 'localhost';
    var port = conf.port || 8019;
    var detached = !!conf.detached;
    function fn(cb) {
        ping.probe(host, port, function (err, available) {
            if (err) {
                cb(err);
            }
            else if (available) {
                cb(null);
            }
            else {
                var n_1 = cp.spawn('node', [p], {
                    detached: detached,
                    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
                });
                n_1.once('message', function (data) {
                    n_1.disconnect();
                    n_1.unref();
                    ijson.parse(data).then(function (d) {
                        if (d.error) {
                            cb(d.error);
                        }
                        else {
                            cb(null);
                        }
                    })
                        .catch(cb);
                });
                n_1.send({ host: host, port: port });
            }
        });
    }
    return sl.conditionalReturn(fn, cb);
};
var $exports = module.exports;
exports.default = $exports;
