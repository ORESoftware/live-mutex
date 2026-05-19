#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("./main");
process.stdin.resume().pipe(new main_1.JSONParser({ debug: true })).on('data', (d) => {
    if (!(d && typeof d === 'object')) {
        console.error('json-parser: parsed value was not an object:', d);
        return;
    }
    return Object.keys(d).forEach(k => {
        console.log(`'${k}'`, `'${JSON.stringify(d[k])}'`);
    });
});
