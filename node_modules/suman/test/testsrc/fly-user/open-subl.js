#!/usr/bin/env node


const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const dir = path.resolve(process.env.HOME + '/suman-test/suman-test-projects/subprojects');

const items = fs.readdirSync(dir).map(function (item) {
    return path.resolve(dir + '/' + item);
});

cp.spawn('subl', items, {
    detached: true
});
