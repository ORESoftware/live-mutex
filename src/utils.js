'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchBrokerInChildProcessp = exports.launchBrokerInChildProcess = exports.conditionallyLaunchSocketServerp = exports.conditionallyLaunchSocketServer = exports.launchSocketServerp = exports.launchSocketServer = void 0;
//core
var cp = require("child_process");
//npm
var ping = require("tcp-ping");
//project
var broker_1_1 = require("./broker-1");
var p = require.resolve('./launch-broker-child');
var log = {
    info: console.log.bind(console, 'lmx utils:'),
    error: console.error.bind(console, 'lmx utils:')
};
var launchSocketServer = function (opts, cb) {
    var host = opts.host || 'localhost';
    var port = opts.port || 6970;
    ping.probe(host, port, function (err, available) {
        if (err) {
            return cb(err, {});
        }
        if (available) {
            return cb(null, 'available');
        }
        return new broker_1_1.Broker1({ host: host, port: port })
            .ensure(cb);
    });
};
exports.launchSocketServer = launchSocketServer;
var launchSocketServerp = function (opts) {
    return new Promise(function (resolve, reject) {
        (0, exports.launchSocketServer)(opts, function (err, val) {
            err ? reject(err) : resolve(val);
        });
    });
};
exports.launchSocketServerp = launchSocketServerp;
// alias
exports.conditionallyLaunchSocketServer = exports.launchSocketServer;
exports.conditionallyLaunchSocketServerp = exports.launchSocketServerp;
var launchBrokerInChildProcess = function (opts, cb) {
    var host = opts.host || 'localhost';
    var port = opts.port || 8019;
    var detached = Boolean(opts.detached);
    ping.probe(host, port, function (err, available) {
        if (err) {
            return cb(err, {});
        }
        if (available) {
            log.info("live-mutex broker/server was already live at ".concat(host, ":").concat(port, "."));
            return cb(null, { host: host, port: port, alreadyRunning: true });
        }
        log.info("live-mutex is launching new broker at '".concat(host, ":").concat(port, "'."));
        var n = cp.spawn('node', [p], {
            detached: detached,
            env: Object.assign({}, process.env, {
                LIVE_MUTEX_PORT: port
            })
        });
        if (detached) {
            n.unref();
        }
        process.once('exit', function () {
            if (!detached) {
                n.kill('SIGINT');
            }
        });
        n.stderr.setEncoding('utf8');
        n.stdout.setEncoding('utf8');
        n.stderr.pipe(process.stderr);
        n.stdout.pipe(process.stdout);
        var stdout = '';
        n.stdout.on('data', function (d) {
            stdout += String(d);
            if (stdout.match(/live-mutex broker is listening/i)) {
                n.stdout.removeAllListeners();
                if (detached) {
                    n.unref();
                }
                cb(null, {
                    liveMutexProcess: n,
                    host: host,
                    port: port,
                    detached: detached
                });
            }
        });
    });
};
exports.launchBrokerInChildProcess = launchBrokerInChildProcess;
var launchBrokerInChildProcessp = function (opts) {
    return new Promise(function (resolve, reject) {
        (0, exports.launchBrokerInChildProcess)(opts, function (err, val) {
            err ? reject(err) : resolve(val);
        });
    });
};
exports.launchBrokerInChildProcessp = launchBrokerInChildProcessp;
