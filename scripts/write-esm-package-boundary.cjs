#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const esmDist = path.resolve(__dirname, '..', 'dist', 'esm');

fs.mkdirSync(esmDist, {recursive: true});
fs.writeFileSync(
  path.resolve(esmDist, 'package.json'),
  JSON.stringify({type: 'module'}, null, 2) + '\n'
);
