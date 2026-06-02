#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const loaderPath = path.resolve(__dirname, '..', 'dist', 'esm', 'package-json-loader.js');

fs.writeFileSync(loaderPath, `'use strict';

import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';

const packageJsonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'package.json'
);

export const packageJsonData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
`);
