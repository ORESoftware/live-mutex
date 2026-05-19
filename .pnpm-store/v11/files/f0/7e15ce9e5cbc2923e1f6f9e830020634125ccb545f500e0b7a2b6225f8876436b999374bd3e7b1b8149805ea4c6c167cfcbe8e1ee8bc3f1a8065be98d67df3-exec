#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const cwd = process.cwd();
const down = [];
let exec, found = false;
const execNameIndex = process.argv.indexOf('--exec-name');
if (execNameIndex < 0) {
    exec = 'suman/dist/cli.js';
}
else {
    exec = '.bin/' + process.argv[execNameIndex + 1];
}
try {
    fs.mkdirSync(path.resolve(process.env.HOME + '/.suman'));
}
catch (err) {
}
let p, cd;
const stat = function (p) {
    try {
        return fs.lstatSync(p).isFile();
    }
    catch (err) {
        if (!String(err.stack || err).match(/ENOENT: no such file or directory/i)) {
            throw err;
        }
        return false;
    }
};
while (true) {
    cd = path.resolve(cwd + down.join(''));
    if (String(cd) === String(path.sep)) {
        break;
    }
    p = path.resolve(cd + '/node_modules/' + exec);
    if (stat(p)) {
        found = true;
        break;
    }
    down.push('/../');
}
if (found) {
    console.log(p);
    process.exit(0);
}
else {
    process.exit(1);
}
