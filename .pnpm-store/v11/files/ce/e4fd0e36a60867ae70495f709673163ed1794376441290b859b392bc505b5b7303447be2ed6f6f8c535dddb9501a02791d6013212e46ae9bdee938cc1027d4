'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const cp = require("child_process");
const async = require("async");
const chalk = require("chalk");
const _suman = global.__suman = (global.__suman || {});
const p = path.resolve(process.env.HOME + '/.suman/global');
exports.run = function (deps) {
    if (deps.length < 1) {
        console.log('\n');
        console.log(chalk.magenta(' => No dependency names passed at command line.'));
        console.log(' => Try this instead: "$ suman --install-globals <dep-name0> <dep-name1> <dep-nameX> "');
        return process.exit(1);
    }
    async.mapSeries(deps, function (d, cb) {
        console.log('\n');
        console.log(' => Suman is now installing the following global dep => ', d);
        const k = cp.spawn('bash', [], {
            cwd: p
        });
        k.stdout.pipe(process.stdout);
        k.stderr.pipe(process.stderr);
        k.once('close', function (code) {
            cb(undefined, {
                name: d,
                code
            });
        });
        const cmd = `npm install -S ${d} --only=production`;
        k.stdin.write('\n' + cmd + '\n');
        k.stdin.end();
    }, function (err, results) {
        if (err) {
            return _suman.log.error(err);
        }
        _suman.log.info('Suman installation result:\n');
        let allGood = results.every(function (r) {
            console.log(r);
            if (r.code > 0) {
                console.log(' => ', r.name, 'may not have been installed successfully.');
                return false;
            }
            return true;
        });
        if (allGood) {
            console.log('\n');
            console.log(' => All deps installed successfully.');
            process.exit(0);
        }
        else {
            console.log('\n');
            console.log(' => Some deps may *not* have been installed successfully.');
            process.exit(1);
        }
    });
};
