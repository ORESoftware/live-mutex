'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var util = require("util");
var path = require("path");
var cp = require("child_process");
var fs = require("fs");
var async = require("async");
var su = require("suman-utils");
var logging_1 = require("./logging");
var cleanStdio = function (stdio) {
    return String(stdio).trim().split('\n').map(function (l) { return String(l).trim(); }).filter(function (i) { return i; }).join('\n');
};
exports.makeTranspileAll = function (watchOpts, projectRoot) {
    return function (transformPaths, cb) {
        var sumanConfig = require(path.resolve(projectRoot + '/suman.conf.js'));
        var filtered = transformPaths.filter(function (t) {
            return t.bashFilePath;
        });
        async.mapLimit(filtered, 4, function (t, cb) {
            su.findApplicablePathsGivenTransform(sumanConfig, t.basePath, function (err, results) {
                if (err) {
                    return cb(err);
                }
                su.makePathExecutable(t.bashFilePath, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    console.log('tttt', util.inspect(t));
                    var uniqueResults = results.filter(function (r, i) {
                        return results.indexOf(r) === i;
                    });
                    var k = cp.spawn('bash', [], {
                        detached: false,
                        cwd: projectRoot || process.cwd(),
                        env: Object.assign({}, process.env, {
                            SUMAN_TEST_PATHS: JSON.stringify(uniqueResults),
                            SUMAN_TRANSFORM_ALL_SOURCES: 'yes'
                        })
                    });
                    fs.createReadStream(t.bashFilePath).pipe(k.stdin);
                    var timedout = false;
                    var onTimeout = function () {
                        timedout = true;
                        k.kill('SIGINT');
                        cb(new Error("transform all process timed out for the @transform.sh file at path \"" + t + "\"."), {
                            path: t,
                            stdout: cleanStdio(stdout),
                            stderr: cleanStdio(stderr)
                        });
                    };
                    var to = setTimeout(onTimeout, 300000);
                    k.once('error', function (e) {
                        logging_1.log.error("spawn error for path => \"" + t + "\" =>\n" + (e.stack || e));
                    });
                    var stdout = '';
                    k.stdout.setEncoding('utf8');
                    k.stdout.on('data', function (d) {
                        stdout += d;
                    });
                    var stderr = '';
                    k.stderr.setEncoding('utf8');
                    k.stderr.on('data', function (d) {
                        stderr += d;
                    });
                    k.once('exit', function (code) {
                        clearTimeout(to);
                        if (!timedout) {
                            cb(null, {
                                path: t,
                                code: code,
                                stdout: cleanStdio(stdout),
                                stderr: cleanStdio(stderr)
                            });
                        }
                    });
                });
            });
        }, cb);
    };
};
