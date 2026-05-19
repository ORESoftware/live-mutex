#!/usr/bin/env node
'use strict';

const fs = require('fs');
const async = require('async');
const path = require('path');
const cp = require('child_process');

const files = fs.readdirSync(path.resolve(__dirname + '/src'));

async.each(files, function (f, cb) {

  if (!path.isAbsolute(f)) {
    f = path.resolve(__dirname + '/src/' + f);
  }

  let k = cp.spawn('node', [f]);

  k.stderr.setEncoding('utf8');
  k.stderr.pipe(process.stderr);

  k.once('exit', cb);

}, function (err) {

  if (err) {
    throw err;
  }

  console.log('all done.');
});
