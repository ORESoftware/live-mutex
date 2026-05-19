'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var assert = require("assert");
var path = require("path");
var cp = require("child_process");
var _ = require("lodash");
var logging_1 = require("./logging");
var su = require("suman-utils");
var chokidar = require("chokidar");
var chalk = require("chalk");
var prepend_transform_1 = require("prepend-transform");
var utils_1 = require("./utils");
var alwaysIgnore = utils_1.default.getAlwaysIgnore();
exports.makeRun = function (projectRoot, paths, sumanOpts) {
    return function run($sumanConfig, isRunNow, cb) {
        var _a = utils_1.default.getWatchObj(projectRoot, sumanOpts, $sumanConfig), watchObj = _a.watchObj, sumanConfig = _a.sumanConfig;
        var includesErr = '"{suman.conf.js}.watch.per" entries must have an "includes/include" property ' +
            'which is a string or array of strings, or a "plugin" property.';
        assert(Array.isArray(watchObj.include) || su.isStringWithPositiveLn(watchObj.include) ||
            Array.isArray(watchObj.includes) || su.isStringWithPositiveLn(watchObj.includes), includesErr);
        var excludesErr = '"{suman.conf.js}.watch.per" entries may have an "excludes/exclude" property but that property must ' +
            'be a string or an array of strings..';
        if (watchObj.excludes || watchObj.exclude) {
            assert(Array.isArray(watchObj.exclude) || su.isStringWithPositiveLn(watchObj.exclude) ||
                Array.isArray(watchObj.excludes) || su.isStringWithPositiveLn(watchObj.excludes), excludesErr);
        }
        var _includes = [watchObj.includes].concat(watchObj.include);
        var includes = _.flattenDeep(_includes).filter(function (i) { return i; });
        {
            includes.forEach(function (v) {
                if (typeof v !== 'string' && !(v instanceof RegExp)) {
                    throw includesErr;
                }
            });
        }
        var _excludes = [watchObj.excludes].concat(watchObj.exclude);
        var excludes = _.flattenDeep(_excludes).filter(function (i) { return i; });
        {
            excludes.forEach(function (v) {
                if (typeof v !== 'string' && !(v instanceof RegExp)) {
                    throw excludesErr;
                }
            });
        }
        assert(su.isStringWithPositiveLn(watchObj.exec), '"exec" property on {suman.conf.js}.watch.per must be a string with length greater than zero.');
        var ignored = alwaysIgnore.concat(excludes)
            .map(function (v) { return v instanceof RegExp ? v : new RegExp(v); });
        var exec = watchObj.exec;
        var watcher = chokidar.watch(includes, {
            persistent: true,
            ignoreInitial: true,
            ignored: ignored,
        });
        watcher.on('error', function (e) {
            logging_1.log.error('suman-watch watcher experienced an error', e.stack || e);
        });
        watcher.once('ready', function () {
            logging_1.log.veryGood('watcher is ready.');
            var watchCount = 0;
            var watched = watcher.getWatched();
            Object.keys(watched).forEach(function (k) {
                var ln = watched[k].length;
                watchCount += ln;
                var pluralOrNot = ln === 1 ? 'item' : 'items';
                logging_1.log.good(ln + " " + pluralOrNot + " watched in this dir => ", k);
            });
            logging_1.log.veryGood('total number of files being watched by suman-watch => ', watchCount);
            cb && cb(null, { watched: watched });
        });
        var createWorker = function () {
            var k = cp.spawn('bash', [], {
                env: Object.assign({}, process.env, {
                    SUMAN_WATCH_TEST_RUN: 'yes'
                })
            });
            k.stdout.pipe(prepend_transform_1.default(chalk.grey(' [watch-worker] '))).pipe(process.stdout);
            k.stderr.pipe(prepend_transform_1.default(chalk.yellow.bold(' [watch-worker] '), { omitWhitespace: true })).pipe(process.stderr);
            return k;
        };
        var running = {
            k: createWorker()
        };
        var startWorker = function () {
            return running.k = createWorker();
        };
        process.stdin.on('data', function onData(d) {
            if (String(d).trim() === 'rr') {
                logging_1.log.info('re-running test execution.');
                startWorker();
                executeExecString();
            }
            else if (String(d).trim() === 'rs') {
                logging_1.log.info('restarting watch-per process.');
                process.stdin.removeListener('data', onData);
                restartWatcher();
            }
            else {
                logging_1.log.info('stdin command not recognized.');
            }
        });
        var restartWatcher = function () {
            logging_1.log.warning('restarting watch-per process.');
            watcher.close();
            watcher.removeAllListeners();
            setImmediate(run, null, true, null);
        };
        var executeExecString = function () {
            logging_1.log.good("now running '" + exec + "'.");
            running.k.stdin.write('\n' + exec + '\n');
            running.k.stdin.end();
        };
        if (isRunNow) {
            executeExecString();
        }
        var first = true;
        watcher.on('change', function (p) {
            logging_1.log.good('change event, file path => ', p);
            if (first) {
                first = false;
            }
            else {
                running.k.kill('SIGKILL');
            }
            if (path.basename(p) === 'suman.conf.js') {
                restartWatcher();
            }
            else {
                startWorker();
                executeExecString();
            }
        });
        var addOrUnlinkTo;
        var onAddOrUnlink = function (p) {
            clearTimeout(addOrUnlinkTo);
            addOrUnlinkTo = setTimeout(restartWatcher, 1000);
        };
        watcher.on('add', onAddOrUnlink);
        watcher.on('unlink', onAddOrUnlink);
    };
};
