'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var fs = require("fs");
var util = require("util");
var cp = require("child_process");
var su = require("suman-utils");
var prepend_transform_1 = require("prepend-transform");
var chalk = require("chalk");
var logging_1 = require("./logging");
exports.makeTranspile = function (watchOpts, projectRoot) {
    return function transpile(f, transformData, isTranspile, cb) {
        if (isTranspile === false) {
            return process.nextTick(cb);
        }
        logging_1.log.info('transform data => ', util.inspect(transformData));
        var transformPath;
        var transformLength = transformData.transform ? transformData.transform.length : 0;
        if (transformData.config && transformData.config.length >= transformLength) {
            try {
                var config = require(transformData.config);
                try {
                    if (config['@transform']['prevent'] === true) {
                        logging_1.log.info('we are not transpiling this file because "prevent" is set to true in @config.json.');
                        return process.nextTick(cb);
                    }
                }
                catch (err) {
                }
                var plugin = config['@transform']['plugin']['value'];
                if (plugin) {
                    transformPath = require(plugin).getTransformPath();
                }
            }
            catch (err) {
            }
        }
        if (!transformPath) {
            if (transformData.transform) {
                transformPath = transformData.transform;
            }
            else {
                logging_1.log.error('no transform method could be found.');
                return process.nextTick(cb);
            }
        }
        su.makePathExecutable(transformPath, function (err) {
            if (err) {
                return cb(err);
            }
            var k = cp.spawn('bash', [], {
                detached: false,
                cwd: projectRoot,
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                env: Object.assign({}, process.env, {
                    SUMAN_PROJECT_ROOT: projectRoot,
                    SUMAN_TEST_PATHS: JSON.stringify([f]),
                    SUMAN_TRANSFORM_ALL_SOURCES: 'no'
                })
            });
            fs.createReadStream(transformPath).pipe(k.stdin);
            k.once('error', function (e) {
                logging_1.log.error("transform process experienced spawn error for path \"" + f + "\" =>\n" + (e.stack || e) + ".");
            });
            var stdout = '';
            k.stdout.setEncoding('utf8');
            k.stdout.pipe(prepend_transform_1.pt(chalk.black.bold(' [watch-worker-transform] '))).pipe(process.stdout);
            k.stdout.on('data', function (d) {
                stdout += d;
            });
            var stderr = '';
            k.stderr.setEncoding('utf8');
            k.stderr.pipe(prepend_transform_1.pt(chalk.yellow(' [watch-worker-transform] '), { omitWhitespace: true })).pipe(process.stderr);
            k.stderr.on('data', function (d) {
                stderr += d;
            });
            var timedout = false;
            var onTimeout = function () {
                timedout = true;
                cb(new Error("transform process timed out for path \"" + f + "\"."), {
                    stdout: String(stdout).trim(),
                    stderr: String(stderr).trim()
                });
            };
            var to = setTimeout(onTimeout, 100000);
            k.once('exit', function (code) {
                if (code > 0) {
                    logging_1.log.warning('transpilation may have failed, the process has exited with code => ', code);
                }
                else {
                    logging_1.log.info('transpilation process appears to be successful, and has exited with code => ', code);
                }
                clearTimeout(to);
                if (!timedout) {
                    var err_1;
                    if (code > 0) {
                        logging_1.log.error(' => There was an error transforming your tests.');
                        err_1 = new Error("transform process at path \"" + f + "\" exited with non-zero exit code =>\n" + stderr);
                    }
                    cb(err_1, {
                        code: code,
                        path: f,
                        stdout: String(stdout).trim(),
                        stderr: String(stderr).trim()
                    });
                }
            });
        });
    };
};
