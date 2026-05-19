'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var fs = require("fs");
var su = require("suman-utils");
var chalk = require("chalk");
var make_transpile_1 = require("./make-transpile");
var make_execute_1 = require("./make-execute");
var logging_1 = require("./logging");
exports.makeRunChangedTestPath = function (watchOpts, projectRoot) {
    var transpile = make_transpile_1.makeTranspile(watchOpts, projectRoot);
    var execute = make_execute_1.makeExecute(watchOpts, projectRoot);
    return function run(f) {
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
                logging_1.log.warning('file will not be transpiled.');
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
                    if (false) {
                        console.log('\n');
                        logging_1.log.info("your corresponding test process for path " + f + ", exited with code " + code);
                        if (code > 0) {
                            logging_1.log.error("there was an error executing your test with path " + f + ", because the exit code was greater than 0.");
                        }
                        if (stderr) {
                            logging_1.log.warning("the stderr for path " + f + ", is as follows =>\n" + chalk.yellow(stderr) + ".");
                            console.log('\n');
                        }
                    }
                });
            });
        });
    };
};
