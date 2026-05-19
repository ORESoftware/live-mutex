#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var fs = require("fs");
var su = require("suman-utils");
var chokidar = require("chokidar");
var chalk = require("chalk");
var make_transpile_1 = require("./make-transpile");
var make_execute_1 = require("./make-execute");
var utils_1 = require("./utils");
var logging_1 = require("./logging");
var testDir = process.env['TEST_DIR'];
var ignored = JSON.parse(process.env['SUMAN_TOTAL_IGNORED']);
var projectRoot = process.env['SUMAN_PROJECT_ROOT'];
var watchOpts = JSON.parse(process.env['SUMAN_WATCH_OPTS']);
var transpile = make_transpile_1.makeTranspile(watchOpts, projectRoot);
var execute = make_execute_1.makeExecute(watchOpts, projectRoot);
var watcher = chokidar.watch(testDir, {
    persistent: true,
    ignoreInitial: true,
    ignored: utils_1.getAlwaysIgnore().concat(ignored).map(function (v) { return new RegExp(v); })
});
process.once('exit', function () {
    watcher.close();
});
process.once('SIGINT', function () {
    watcher.once('close', function () {
        console.log('watch is closed due to SIGINT event.');
        process.exit(0);
    });
    watcher.close();
});
watcher.on('error', function (e) {
    logging_1.log.error('watcher experienced an error', e.stack || e);
});
watcher.once('ready', function () {
    logging_1.log.veryGood('watcher is ready.');
    var watchCount = 0;
    var watched = watcher.getWatched();
    Object.keys(watched).forEach(function (k) {
        watchCount += watched[k].length;
    });
    logging_1.log.veryGood('number of files being watched by suman-watch => ', watchCount);
});
watcher.on('change', function (f) {
    if (utils_1.isPathMatchesSig(path.basename(f))) {
        return;
    }
    var dn = path.basename(path.dirname(f));
    var canonicalDirname = String('/' + dn + '/').replace(/\/+/g, '/');
    var originalFile;
    var resolvedWithRoot = false;
    if (!path.isAbsolute(f)) {
        originalFile = f;
        f = path.resolve(projectRoot + '/' + f);
        resolvedWithRoot = true;
    }
    try {
        fs.statSync(f);
    }
    catch (err) {
        if (originalFile) {
            logging_1.log.error('file was resolved against project root => ', originalFile);
            logging_1.log.error("this file may have been resolved incorrectly; it was resolved to: \"" + f + "\".");
            throw new Error("'suman-watch' implementation error - watched paths must be absolute -> \n\t \"" + originalFile + "\"");
        }
    }
    delete require.cache[f];
    logging_1.log.info('file change event for path => ', f);
    su.findNearestRunAndTransform(projectRoot, f, function (err, ret) {
        if (err) {
            logging_1.log.error("error locating @run.sh / @transform.sh for file " + f + ".\n" + err);
            return;
        }
        var matched = false;
        try {
            if (ret.config) {
                var config = require(ret.config);
                var match = config['@src']['marker'];
                var canonicalMatch = String('/' + match + '/').replace(/\/+/g, '/');
                if (canonicalDirname.match(new RegExp(canonicalMatch))) {
                    matched = true;
                }
            }
        }
        catch (err) {
            logging_1.log.error(err.stack || err);
        }
        finally {
            if (dn.match(/\/@src\//)) {
                matched = true;
            }
        }
        if (!matched) {
            logging_1.log.error('file will not be transpiled.');
        }
        transpile(f, ret, matched, function (err) {
            if (err) {
                logging_1.log.error("error running transpile process for file " + f + ".\n" + err);
                return;
            }
            execute(f, ret, function (err, result) {
                if (err) {
                    logging_1.log.error("error executing corresponding test process for source file " + f + ".\n" + (err.stack || err));
                    return;
                }
                var stdout = result.stdout, stderr = result.stderr, code = result.code;
                if (code === -1) {
                    return;
                }
                if (code === undefined) {
                    logging_1.log.warning('suman-watcher implementation warning, exit code was undefined.');
                }
                console.log('\n');
                logging_1.log.info("your corresponding test process for path " + f + ", exited with code " + code);
                if (code > 0) {
                    logging_1.log.error("there was an error executing your test with path " + f + ", because the exit code was greater than 0.");
                }
                if (stderr) {
                    logging_1.log.warning("the stderr for path " + f + ", is as follows =>\n" + chalk.yellow(stderr) + ".");
                    console.log('\n');
                }
            });
        });
    });
});
