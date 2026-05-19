'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const chalk = require("chalk");
const _suman = global.__suman = (global.__suman || {});
let logged = true;
exports.logPermissonsAdvice = function () {
    if (logged) {
        logged = false;
        console.log('\n');
        _suman.log.info(chalk.magenta('You may wish to run the "$ suman --init" commmand with root permissions.'));
        _suman.log.info(chalk.magenta('If using sudo to run arbitrary/unknown commands makes you unhappy, then please use chown as following:'));
        console.log(chalk.bgBlack.cyan('  # chown -R $(whoami) $(npm root -g) $(npm root) ~/.npm  ') + '\n\n');
    }
};
