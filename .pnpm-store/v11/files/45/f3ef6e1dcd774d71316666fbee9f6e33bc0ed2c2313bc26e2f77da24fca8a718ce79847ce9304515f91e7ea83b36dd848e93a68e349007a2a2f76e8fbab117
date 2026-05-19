'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const cp = require("child_process");
const fs = require("fs");
const chalk = require("chalk");
const su = require("suman-utils");
const prepend_transform_1 = require("prepend-transform");
const uuid = require("uuid");
const _suman = global.__suman = (global.__suman || {});
const runner_utils_1 = require("../runner-utils");
exports.makeAddToTranspileQueue = function (f, transpileQueue, tableRows, ganttHash, projectRoot) {
    const { sumanOpts } = _suman;
    const inheritTransformStdio = sumanOpts.inherit_all_stdio ||
        sumanOpts.inherit_transform_stdio || process.env.SUMAN_INHERIT_STDIO;
    return function (fileShortAndFull) {
        const uuidV4 = String(uuid.v4());
        const file = fileShortAndFull[0];
        const shortFile = fileShortAndFull[1];
        const filePathFromProjectRoot = fileShortAndFull[2];
        let basename = file.length > 28 ? ' ' + String(file).substring(Math.max(0, file.length - 28)) + ' ' : file;
        const m = String(basename).match(/\//g);
        if (m && m.length > 1) {
            const arr = String(basename).split('');
            let i = 0;
            while (arr[i] !== '/') {
                arr.shift();
            }
            basename = arr.join('');
        }
        tableRows[String(shortFile)] = {
            actualExitCode: null,
            shortFilePath: shortFile,
            tableData: null,
            defaultTableData: {
                SUITES_DESIGNATOR: basename
            }
        };
        const gd = ganttHash[uuidV4] = {
            uuid: uuidV4,
            fullFilePath: String(file),
            shortFilePath: String(shortFile),
            filePathFromProjectRoot: String(filePathFromProjectRoot),
        };
        const tr = (sumanOpts.no_transpile !== true) && runner_utils_1.findPathOfTransformDotSh(file);
        if (tr) {
            _suman.log.info(chalk.bgWhite.underline('Suman has found a @transform.sh file => '), chalk.bold(tr));
            transpileQueue.push(function (cb) {
                su.makePathExecutable(tr, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    gd.transformStartDate = Date.now();
                    let k = cp.spawn(tr, [], {
                        cwd: projectRoot,
                        env: Object.assign({}, process.env, {
                            SUMAN_TEST_PATHS: JSON.stringify([file]),
                            SUMAN_CHILD_TEST_PATH: file
                        })
                    });
                    k.once('error', cb);
                    k.stderr.setEncoding('utf8');
                    k.stdout.setEncoding('utf8');
                    const ln = String(_suman.projectRoot).length;
                    if (false) {
                        let onError = function (e) {
                            _suman.log.error('\n', su.getCleanErrorString(e), '\n');
                        };
                        const temp = su.removePath(file, _suman.projectRoot);
                        const onlyFile = String(temp).replace(/\//g, '.');
                        const logfile = path.resolve(f + '/' + onlyFile + '.log');
                        let fileStrm = fs.createWriteStream(logfile);
                        k.stderr.pipe(fileStrm).once('error', onError);
                        k.stdout.pipe(fileStrm).once('error', onError);
                    }
                    if (inheritTransformStdio) {
                        let onError = function (e) {
                            _suman.log.error('\n', su.getCleanErrorString(e), '\n');
                        };
                        let stderrPrepend = ` [${chalk.red('transform process stderr:')} ${chalk.red.bold(String(file.slice(ln)))}] `;
                        k.stderr.pipe(prepend_transform_1.pt(stderrPrepend, { omitWhitespace: true })).once('error', onError).pipe(process.stderr);
                        let stdoutPrepend = ` [${chalk.yellow('transform process stdout:')} ${chalk.gray.bold(String(file.slice(ln)))}] `;
                        k.stdout.pipe(prepend_transform_1.pt(stdoutPrepend)).once('error', onError).pipe(process.stdout);
                    }
                    let stdout = '';
                    k.stdout.on('data', function (data) {
                        stdout += data;
                    });
                    let stderr = '';
                    k.stderr.on('data', function (data) {
                        stderr += data;
                    });
                    k.once('exit', function (code) {
                        gd.transformEndDate = Date.now();
                        if (code > 0) {
                            cb(new Error(`the @transform.sh process, for file ${file},\nexitted with non-zero exit code. :( 
                  \n To see the stderr, use "--inherit-stdio" or "--inherit-all-stdio".`));
                        }
                        else {
                            cb(null, file, shortFile, stdout, stderr, gd);
                        }
                    });
                });
            });
        }
        else {
            gd.transformStartDate = gd.transformEndDate = null;
            gd.wasTransformed = false;
            transpileQueue.unshift(function (cb) {
                setImmediate(function () {
                    cb(null, file, shortFile, '', '', gd);
                });
            });
        }
    };
};
