'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchBrokerInChildProcessp = exports.launchBrokerInChildProcess = exports.conditionallyLaunchSocketServerp = exports.conditionallyLaunchSocketServer = exports.launchSocketServerp = exports.launchSocketServer = void 0;
const cp = require("child_process");
const ping = require("tcp-ping");
const broker_1_1 = require("./broker-1");
const p = require.resolve('./launch-broker-child');
const log = {
    info: console.log.bind(console, 'lmx utils:'),
    error: console.error.bind(console, 'lmx utils:')
};
const launchSocketServer = function (opts, cb) {
    const host = opts.host || 'localhost';
    const port = opts.port || 6970;
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
const launchSocketServerp = function (opts) {
    return new Promise((resolve, reject) => {
        (0, exports.launchSocketServer)(opts, function (err, val) {
            err ? reject(err) : resolve(val);
        });
    });
};
exports.launchSocketServerp = launchSocketServerp;
exports.conditionallyLaunchSocketServer = exports.launchSocketServer;
exports.conditionallyLaunchSocketServerp = exports.launchSocketServerp;
const launchBrokerInChildProcess = function (opts, cb) {
    const host = opts.host || 'localhost';
    const port = opts.port || 8019;
    const detached = Boolean(opts.detached);
    ping.probe(host, port, function (err, available) {
        if (err) {
            return cb(err, {});
        }
        if (available) {
            log.info(`live-mutex broker/server was already live at ${host}:${port}.`);
            return cb(null, { host, port, alreadyRunning: true });
        }
        log.info(`live-mutex is launching new broker at '${host}:${port}'.`);
        const n = cp.spawn('node', [p], {
            detached,
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
        let stdout = '';
        n.stdout.on('data', function (d) {
            stdout += String(d);
            if (stdout.match(/live-mutex broker is listening/i)) {
                n.stdout.removeAllListeners();
                if (detached) {
                    n.unref();
                }
                cb(null, {
                    liveMutexProcess: n,
                    host,
                    port,
                    detached
                });
            }
        });
    });
};
exports.launchBrokerInChildProcess = launchBrokerInChildProcess;
const launchBrokerInChildProcessp = function (opts) {
    return new Promise((resolve, reject) => {
        (0, exports.launchBrokerInChildProcess)(opts, (err, val) => {
            err ? reject(err) : resolve(val);
        });
    });
};
exports.launchBrokerInChildProcessp = launchBrokerInChildProcessp;
