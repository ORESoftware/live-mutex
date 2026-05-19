'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require('path');
const fs = require('fs');
const replaceStrm = require('replacestream');
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const SUMAN_SINGLE_PROCESS = process.env.SUMAN_SINGLE_PROCESS === 'yes';
let callable = true;
exports.run = function (filePath) {
    if (!callable) {
        return;
    }
    callable = false;
    if (process.env.MAKE_SUMAN_LOG !== 'no') {
        if (su.vgt(6)) {
            _suman.log.info('we are logging child stdout/stderr to files.', '\n');
        }
        const timestamp = process.env.SUMAN_RUNNER_TIMESTAMP;
        const runId = process.env.SUMAN_RUN_ID;
        const logsDir = _suman.sumanConfig.logsDir || _suman.sumanHelperDirRoot + '/logs';
        const sumanCPLogs = path.resolve(logsDir + '/runs/');
        const f = path.resolve(sumanCPLogs + '/' + timestamp + '-' + runId);
        if (SUMAN_SINGLE_PROCESS) {
            _suman.log.error('\n');
            _suman.log.error('in SUMAN_SINGLE_PROCESS mode, and we are not currently configured to log stdio to log file.');
            _suman.log.error('\n');
            return;
        }
        let isDeleteFile = true, writeToFileStream = true;
        const temp = su.removePath(filePath, _suman.projectRoot);
        const onlyFile = String(temp).replace(/\//g, '.');
        const logfile = path.resolve(f + '/' + onlyFile + '.log');
        const rstrm = replaceStrm(/\[\d{1,2}(;\d{1,2})?m/g, '');
        const strm = rstrm.pipe(fs.createWriteStream(logfile));
        strm.on('error', function (e) {
            _suman.log.error(e.stack || e);
        });
        _suman.endLogStream = function () {
            writeToFileStream = false;
            strm.end('this is the end of the Suman test stream.\n');
        };
        strm.on('drain', function () {
            _suman.isStrmDrained = true;
            _suman.drainCallback && _suman.drainCallback(logfile);
        });
        if (true || _suman.sumanConfig.isLogChildStderr) {
            const stderrWrite = process.stderr.write;
            process.stderr.write = function () {
                _suman.isStrmDrained = false;
                isDeleteFile = false;
                if (writeToFileStream) {
                    strm.write.apply(strm, arguments);
                }
                stderrWrite.apply(process.stderr, arguments);
            };
        }
        fs.appendFileSync(logfile, ' => Beginning of debug log for test with full path => \n' + filePath + '\n');
        if (true || _suman.sumanConfig.isLogChildStdout) {
            const stdoutWrite = process.stdout.write;
            process.stdout.write = function () {
                _suman.isStrmDrained = false;
                isDeleteFile = false;
                if (writeToFileStream) {
                    strm.write.apply(strm, arguments);
                }
                stdoutWrite.apply(process.stdout, arguments);
            };
        }
        process.once('exit', function () {
            if (isDeleteFile && false) {
                try {
                    fs.unlinkSync(logfile);
                }
                catch (err) {
                    _suman.log.error(' => Could not unlink extraneous log file at path => ', logfile);
                }
            }
            else {
            }
        });
    }
};
