#!/usr/bin/env node
'use strict';

const v = process.argv[2];
console.log(v.slice(0, v.lastIndexOf('.')));