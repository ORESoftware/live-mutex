'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const EE = require("events");
const fs = require("fs");
const suman_events_1 = require("suman-events");
const su = require("suman-utils");
const async = require("async");
const _suman = global.__suman = (global.__suman || {});
const handle_runner_request_response_1 = require("../index-helpers/handle-runner-request-response");
const handle_suman_once_post_1 = require("./handle-suman-once-post");
const general_1 = require("./general");
const socketio_child_client_1 = require("../index-helpers/socketio-child-client");
const reporterRets = _suman.reporterRets = (_suman.reporterRets || []);
const suiteResultEmitter = _suman.suiteResultEmitter = _suman.suiteResultEmitter || new EE();
const rb = _suman.resultBroadcaster = _suman.resultBroadcaster || new EE();
const results = _suman.tableResults = _suman.tableResults || [];
let isShutdown = false;
exports.shutdownProcess = function () {
    if (isShutdown) {
        _suman.log.warning('implementation error, process shutdown has already commenced.');
        return;
    }
    isShutdown = true;
    let fn, resultz;
    if (_suman.usingRunner) {
        resultz = results.map(i => i.tableData);
        fn = handle_runner_request_response_1.handleRequestResponseWithRunner(resultz);
    }
    else if (_suman.inBrowser) {
        resultz = results.map(i => i.tableData);
        fn = handle_runner_request_response_1.handleRequestResponseWithRunner(resultz);
    }
    else {
        resultz = results.filter(r => r);
        resultz.forEach(function (r) {
            rb.emit(String(suman_events_1.events.STANDARD_TABLE), r.tableData, r.exitCode);
        });
        fn = handle_suman_once_post_1.oncePostFn;
    }
    const codes = results.map(i => i.exitCode);
    if (su.vgt(6)) {
        _suman.log.info(' => All "exit" codes from test suites => ', util.inspect(codes));
    }
    const highestExitCode = Math.max.apply(null, codes);
    fn(function (err) {
        err && _suman.log.error(err.stack || err);
        rb.emit(String(suman_events_1.events.META_TEST_ENDED));
        _suman.endLogStream && _suman.endLogStream();
        let waitForStdioToDrain = function (cb) {
            if (_suman.inBrowser) {
                _suman.log.info('we are in browser no drain needed.');
                return process.nextTick(cb);
            }
            if (_suman.isStrmDrained) {
                _suman.log.info('Log stream is already drained.');
                return process.nextTick(cb);
            }
            let timedout = false;
            let timeout = _suman.usingRunner ? 20 : 10;
            let onTimeout = function () {
                timedout = true;
                cb(null);
            };
            let to = setTimeout(onTimeout, timeout);
            _suman.drainCallback = function (logpath) {
                clearTimeout(to);
                _suman.log.warning('Drain callback was actually called.');
                try {
                    fs.appendFileSync(logpath, 'Drain callback was indeed called.');
                }
                finally {
                    console.log('we are in finally...');
                    if (!timedout) {
                        console.log('finally has not timedout...');
                        process.nextTick(cb);
                    }
                }
            };
        };
        async.parallel({
            wait: waitForStdioToDrain,
            reporters: general_1.makeHandleAsyncReporters(reporterRets),
        }, function (err, results) {
            const exitCode = String(results.reporters ? results.reporters.exitCode : '0');
            try {
                if (window && !window.__karma__) {
                    const childId = window.__suman.SUMAN_CHILD_ID;
                    const client = socketio_child_client_1.getClient();
                    client.emit('BROWSER_FINISHED', {
                        childId: childId,
                        exitCode: exitCode,
                        type: 'BROWSER_FINISHED',
                    }, function () {
                        console.error('"BROWSER_FINISHED" message received by Suman runner.');
                        console.error('If you can see this message, it is likely that the Suman runner was not able to close the browser process.');
                    });
                }
            }
            catch (err) {
                process.exit(highestExitCode);
            }
        });
    });
};
exports.handleSingleFileShutdown = function () {
    suiteResultEmitter.once('suman-test-file-complete', exports.shutdownProcess);
};
