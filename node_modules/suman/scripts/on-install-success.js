#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log(' => Suman postinstall script succeeded.','\n');

const debug = require('suman-debug');
const debugPostinstall = debug('s:postinstall');

debugPostinstall(' => Suman post-install script succeeded');
