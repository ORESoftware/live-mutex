'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const chalk = require("chalk");
const pkgDotJSON = require('../../package.json');
const _suman = global.__suman = (global.__suman || {});
let gv;
if (gv = process.env.SUMAN_GLOBAL_VERSION) {
    const lv = String(pkgDotJSON.version);
    if (gv !== lv) {
        console.error('\n');
        _suman.log.error(chalk.red('warning => You local version of Suman differs from the cli version of Suman.'));
        _suman.log.warning(chalk.gray.bold(' [suman] '), 'Suman global version => ', gv);
        _suman.log.warning(chalk.gray.bold(' [suman] '), 'Suman local version => ', lv);
        console.error('\n');
    }
}
