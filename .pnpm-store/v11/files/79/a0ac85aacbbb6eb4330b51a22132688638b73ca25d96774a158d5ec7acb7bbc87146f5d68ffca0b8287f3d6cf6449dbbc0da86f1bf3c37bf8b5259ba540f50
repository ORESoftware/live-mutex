#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const cwd = process.cwd();
const down = [];
let found = false, p, cd;
const stat = function (p) {
    try {
        return fs.statSync(p).isFile();
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
    p = path.resolve(cd + '/package.json');
    if (stat(p)) {
        found = true;
        break;
    }
    down.push('/../');
}
if (found) {
    console.log(path.dirname(p));
    process.exit(0);
}
else {
    process.exit(1);
}
