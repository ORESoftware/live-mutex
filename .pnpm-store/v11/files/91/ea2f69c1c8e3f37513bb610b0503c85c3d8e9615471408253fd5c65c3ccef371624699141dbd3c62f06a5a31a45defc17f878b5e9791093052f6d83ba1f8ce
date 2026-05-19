'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const cp = require("child_process");
const path = require("path");
const util = require("util");
const assert = require("assert");
const chalk = require("chalk");
const _suman = global.__suman = (global.__suman || {});
exports.runUseSh = function (strm, item, cb) {
    const { projectRoot, sumanOpts } = _suman;
    if (item.script) {
        let exec = 'bash';
        if (typeof item.script === 'object') {
            exec = item.script.interpreter || exec;
            item.script = item.script.str;
        }
        assert(typeof item.script === 'string', ' => suman.group item has script property which does not point to a string => ' + util.inspect(item));
        let n = cp.spawn(exec, [], {
            cwd: item.cwd || process.cwd()
        });
        n.stdin.setEncoding('utf8');
        n.stderr.setEncoding('utf8');
        n.stdout.setEncoding('utf8');
        n.stdin.write('\n' + item.script + '\n');
        process.nextTick(function () {
            n.stdin.end();
        });
        if (!sumanOpts.no_stream_to_console) {
            n.stdout.pipe(process.stdout, { end: false });
            n.stderr.pipe(process.stderr, { end: false });
        }
        if (!sumanOpts.no_stream_to_file) {
            n.stdout.pipe(strm, { end: false });
            n.stderr.pipe(strm, { end: false });
        }
        n.on('close', function (code) {
            cb(null, {
                code: code,
                name: item.name
            });
        });
    }
    else if (typeof item.getPathToScript === 'function') {
        const b = item.getPathToScript();
        assert(path.isAbsolute(b), ' => Path to group script must be absolute.');
        console.log(chalk.red.bold('path to script => ', b));
        let n = cp.spawn(b, [], {
            cwd: item.cwd || process.cwd()
        });
        n.stdin.setEncoding('utf8');
        n.stderr.setEncoding('utf8');
        n.stdout.setEncoding('utf8');
        if (!sumanOpts.no_stream_to_console) {
            n.stdout.pipe(process.stdout, { end: false });
            n.stderr.pipe(process.stderr, { end: false });
        }
        if (!sumanOpts.no_stream_to_file) {
            n.stdout.pipe(strm, { end: false });
            n.stderr.pipe(strm, { end: false });
        }
        n.on('close', function (code) {
            cb(null, {
                code: code,
                name: item.name
            });
        });
    }
    else {
        throw new Error(' => Suman usage error => You do not have the necessary properties on your suman.group item.\n' +
            'Please see xxx.');
    }
};
