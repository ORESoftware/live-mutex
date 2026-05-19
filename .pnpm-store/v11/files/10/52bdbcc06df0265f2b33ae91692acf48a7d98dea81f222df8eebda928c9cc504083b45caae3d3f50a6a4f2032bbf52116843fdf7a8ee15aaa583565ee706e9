'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const assert = require("assert");
const cp = require("child_process");
const util = require("util");
const su = require("suman-utils");
const chalk = require("chalk");
const prepend_transform_1 = require("prepend-transform");
const _suman = global.__suman = (global.__suman || {});
exports.run = function (sumanConfig, opts) {
    const k = cp.spawn('bash');
    const scriptKey = opts.script;
    assert(su.isStringWithPositiveLn(scriptKey), 'script key must be a string.');
    let scriptValue;
    try {
        scriptValue = sumanConfig['scripts'][scriptKey];
        assert(su.isStringWithPositiveLn(scriptValue), `script value must be a string with positive length, instead we got <${util.inspect(scriptValue)}>.`);
    }
    catch (err) {
        if (sumanConfig['scripts']) {
            _suman.log.info('Here are the available scripts in your suman.conf.js file:');
            _suman.log.info(util.inspect(sumanConfig['scripts']));
        }
        throw err;
    }
    k.stdin.setDefaultEncoding('utf8');
    k.stdout.setEncoding('utf8');
    k.stderr.setEncoding('utf8');
    console.log('\n');
    _suman.log.info(`Your script with key '${chalk.magenta(scriptKey)}' is now running, and its output follows:\n`);
    k.stdout.pipe(prepend_transform_1.pt(chalk.blue(' [suman script stdout]: '))).pipe(process.stdout);
    k.stderr.pipe(prepend_transform_1.pt(chalk.red(' [suman script stderr]: '))).pipe(process.stderr);
    k.stdin.write('\n');
    k.stdin.write(scriptValue);
    k.stdin.end('\n');
    k.once('exit', function (code) {
        console.log('\n');
        console.error('\n');
        if (code > 0) {
            _suman.log.error(`script with key '${scriptKey}' exited with code ${code}`);
        }
        else {
            _suman.log.info(`script with key '${scriptKey}' exited with code ${code}`);
        }
        process.exit(code);
    });
};
