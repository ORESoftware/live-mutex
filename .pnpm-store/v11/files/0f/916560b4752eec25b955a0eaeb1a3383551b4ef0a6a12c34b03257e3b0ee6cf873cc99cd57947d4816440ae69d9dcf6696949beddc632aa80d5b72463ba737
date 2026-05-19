'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var util = require("util");
var assert = require("assert");
var path = require("path");
var cp = require("child_process");
var logging_1 = require("./logging");
var su = require("suman-utils");
var chokidar = require("chokidar");
var chalk = require("chalk");
var prepend_transform_1 = require("prepend-transform");
var utils_1 = require("./utils");
var alwaysIgnore = utils_1.default.getAlwaysIgnore();
var totallyKillProcess = function (proc, timeout) {
    proc.kill('SIGINT');
    proc.unref();
    proc.removeAllListeners();
    proc.stdout && proc.stdout.removeAllListeners();
    proc.stderr && proc.stderr.removeAllListeners();
    proc.stdin && proc.stdin.removeAllListeners();
    setTimeout(function () {
        proc.kill('SIGKILL');
    }, timeout || 3000);
};
exports.makeRun = function (projectRoot, paths, sumanOpts) {
    return function run($sumanConfig, isRunNow, cb) {
        var _a = utils_1.default.getWatchObj(projectRoot, sumanOpts, $sumanConfig), watchObj = _a.watchObj, sumanConfig = _a.sumanConfig;
        var plugin;
        assert(su.isObject(watchObj.plugin), 'watch object plugin value is not an object.');
        if (watchObj.plugin.isSumanWatchPluginModule) {
            plugin = watchObj.plugin.value;
        }
        else if (watchObj.plugin.isSumanWatchPluginValue) {
            plugin = watchObj.plugin;
        }
        else {
            throw new Error('watch object "plugin" value does not adhere to the expected interface => ' + util.inspect(watchObj));
        }
        var pluginName = plugin.pluginName || 'unknown-watch-plugin';
        var stdoutStartTranspileRegex = plugin.stdoutStartTranspileRegex;
        var stdoutEndTranspileRegex = plugin.stdoutEndTranspileRegex;
        var pluginEnv = plugin.pluginEnv || {};
        assert(su.isObject(pluginEnv), '"env" property on plugin must be a plain object.');
        var testEnv = watchObj.env || {};
        assert(su.isObject(testEnv), '"env" property on watch object must be a plain object.');
        var execTests = watchObj.exec || plugin.execTests;
        var pluginExec = plugin.pluginExec;
        assert(su.isStringWithPositiveLn(execTests), '"execTests" property on plugin value must be a string with length greater than zero;\n' +
            'if no "execTests" property is used on the pluging, an "exec" property must be defined on the watch per object.');
        assert(su.isStringWithPositiveLn(pluginExec), '"execTransform" property on plugin object value must be a string with length greater than zero.');
        assert(stdoutStartTranspileRegex, '"stdoutStartTranspileRegex" property needs to be defined as a String or RegExp.');
        assert(stdoutEndTranspileRegex, '"stdoutEndTranspileRegex" property needs to be defined as a String or RegExp.');
        var details = {
            exitOk: false
        };
        var createWatcherPluginProcess = function () {
            var k = cp.spawn('bash', [], {
                cwd: plugin.pluginCwd || process.cwd(),
                env: Object.assign({}, process.env, pluginEnv, {
                    SUMAN_WATCH_PLUGIN_RUN: 'yes'
                })
            });
            cb && k.once('error', cb);
            k.stdout.pipe(prepend_transform_1.default(chalk.grey(" [" + pluginName + "-worker] "))).pipe(process.stdout);
            k.stderr.pipe(prepend_transform_1.default(chalk.yellow.bold(" [" + pluginName + "-worker] "), { omitWhitespace: true })).pipe(process.stderr);
            setImmediate(function () {
                k.stdin.end('\n' + pluginExec + '\n');
            });
            k.once('exit', function () {
                if (!details.exitOk) {
                    logging_1.log.warning('watcher process exitted (perhaps unexpectedly), to restart watch process, send "rs" to stdin.');
                }
            });
            return k;
        };
        var watcherPluginProcess = {
            k: createWatcherPluginProcess()
        };
        var testProcessWorker = {
            k: null
        };
        var killTestProcess = function () {
            if (testProcessWorker.k) {
                logging_1.log.warning('killing currently running test(s).');
                totallyKillProcess(testProcessWorker.k);
            }
        };
        var firstListener = true;
        var startTestProcess = function () {
            var testProcess = testProcessWorker.k = cp.spawn('bash', [], {
                env: Object.assign({}, process.env, testEnv, {
                    SUMAN_WATCH_TEST_RUN: 'yes'
                })
            });
            setImmediate(function () {
                testProcess.stdin.end('\n' + execTests + '\n');
            });
            testProcess.stdout.pipe(prepend_transform_1.default(chalk.grey(" [suman-watch-test-process] "))).pipe(process.stdout);
            testProcess.stderr.pipe(prepend_transform_1.default(chalk.yellow.bold(" [suman-watch-test-process] "), { omitWhitespace: true })).pipe(process.stderr);
            testProcess.once('exit', function (code, signal) {
                if (Number.isInteger(code)) {
                    if (code > 0) {
                        logging_1.log.error('test process exited with code ', code);
                    }
                    else {
                        logging_1.log.veryGood('test process exited with code', code);
                    }
                }
                else if ((signal = String(signal).trim())) {
                    logging_1.log.warning('test process was killed by signal', signal);
                }
                else {
                    logging_1.log.warning('test process was killed with unknown exit code and signal.');
                }
                if (firstListener) {
                    firstListener = false;
                    logging_1.log.info(chalk.bold('now listening for "rs" or "rr" commands via stdin.'));
                    process.stdin.on('data', onStdinData);
                }
            });
        };
        var firstBadStdin = true;
        var onStdinData = function (d) {
            if (String(d).trim() === 'rr') {
                logging_1.log.info('"rr" command received: re-running test execution.');
                runNewTestProcess();
            }
            else if (String(d).trim() === 'rs') {
                logging_1.log.info('"rs" (restart) command received: will restart watching process.');
                restartWatcher('user restarted the process with "rs" stdin command.');
            }
            else if (String(d).trim() === '') {
                if (firstBadStdin) {
                    firstBadStdin = false;
                    logging_1.log.warning('stdin command not recognized => ' +
                        'try "rs" to restart the watcher process, or "rr" to re-run the most recently executed test.');
                }
            }
            else {
                logging_1.log.warning('stdin command not recognized => ' +
                    'try "rs" to restart the watcher process, or "rr" to re-run the most recently executed test.');
            }
        };
        var restartPluginWatcherThrottleTimeout;
        var restartPluginWatcherThrottle = function (reason) {
            clearTimeout(restartPluginWatcherThrottleTimeout);
            restartPluginWatcherThrottleTimeout = setTimeout(function () {
                restartWatcher(reason);
            }, 1000);
        };
        var restartWatcher = function (reason) {
            try {
                process.stdin.removeListener('data', onStdinData);
            }
            catch (err) {
                logging_1.log.warning(err.message);
            }
            if (chokidarWatcher) {
                chokidarWatcher.close();
                chokidarWatcher.removeAllListeners();
            }
            clearTimeout(restartPluginWatcherThrottleTimeout);
            logging_1.log.warning('restarting watch-per process' + (reason || '.'));
            if (watcherPluginProcess.k) {
                logging_1.log.warning('killing current watch plugin process.');
                totallyKillProcess(watcherPluginProcess.k, 1000);
            }
            setImmediate(run, null, false, null);
        };
        var runNewTestProcess = function () {
            logging_1.log.veryGood(chalk.green.bold("Now running test process using: ") + (chalk.bgBlack("'" + chalk.white.bold(execTests) + "'") + "."));
            killTestProcess();
            startTestProcess();
        };
        if (isRunNow) {
            runNewTestProcess();
        }
        var watcherStdio = {
            stdout: '',
            stderr: ''
        };
        watcherPluginProcess.k.stderr.once('data', function (p) {
            cb && cb(String(p));
        });
        watcherPluginProcess.k.stdout.on('data', function (p) {
            cb && cb(null);
            watcherStdio.stdout += String(p);
            if (stdoutEndTranspileRegex.test(watcherStdio.stdout)) {
                watcherStdio.stdout = '';
                logging_1.log.veryGood(chalk.bold('running a new test process: stdout from watch worker has indicated compilation has finished.'));
                runNewTestProcess();
                return;
            }
            if (stdoutStartTranspileRegex.test(watcherStdio.stdout)) {
                watcherStdio.stdout = '';
                logging_1.log.warning(chalk.yellow('killing any currently running test process, since we have received stdout matching a new compilation phase.'));
                killTestProcess();
            }
        });
        var chokidarWatcher = chokidar.watch('**/*.js', {
            cwd: projectRoot,
            persistent: true,
            ignoreInitial: true,
            ignored: /(\.log$|\/.idea\/|\/node_modules\/suman\/)/
        });
        chokidarWatcher.on('error', function (e) {
            logging_1.log.error('suman-watch watcher experienced an error', e.stack || e);
        });
        chokidarWatcher.once('ready', function () {
            logging_1.log.veryGood('watcher is ready.');
            var watchCount = 0;
            var watched = chokidarWatcher.getWatched();
            Object.keys(watched).forEach(function (k) {
                var ln = watched[k].length;
                watchCount += ln;
            });
            logging_1.log.veryGood('total number of files being watched by suman-watch process ', watchCount);
        });
        chokidarWatcher.on('change', function (p) {
            logging_1.log.good('change event, file path => ', chalk.gray(p));
            if (path.basename(p) === 'suman.conf.js') {
                restartPluginWatcherThrottle('suman.conf.js file changed.');
            }
        });
        chokidarWatcher.on('add', function (file) {
            logging_1.log.info('file was added: ' + chalk.gray(file));
        });
        chokidarWatcher.on('unlink', function (file) {
            logging_1.log.info('file was unlinked: ' + chalk.gray(file));
        });
    };
};
