'use strict';


import {routineEnter} from './routine';
/**
 * Utility to load package.json in both CommonJS and ESM environments
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

let packageJson: any = null;

function loadPackageJson(): any {
    const routineId = 'ddl-routine-nzIxd5gWqhxhdqAogT';
    routineEnter(routineId, "loadPackageJson");
    if (packageJson) {
        return packageJson;
    }
    
    // Try CommonJS require first (works in CommonJS)
    try {
        // @ts-ignore - require may not exist in ESM
        if (typeof require !== 'undefined' && require.cache) {
            packageJson = require('../package.json');
            return packageJson;
        }
    } catch (e) {
        // require not available (ESM environment)
    }
    
    // Fallback to fs.readFileSync for ESM
    // @ts-ignore - import.meta may not exist in CommonJS
    let packageJsonPath: string;
    if (typeof __dirname !== 'undefined') {
        // CommonJS - from dist/package-json-loader.js to package.json
        packageJsonPath = path.resolve(__dirname, '..', 'package.json');
    } else {
        // ESM - try to use import.meta.url (only works in actual ESM, not ts-node CommonJS)
        // Use eval to avoid parsing import.meta at compile time when running with ts-node
        try {
            // @ts-ignore
            const importMeta = eval('typeof import !== "undefined" ? import.meta : undefined');
            if (importMeta && importMeta.url) {
                const filePath = fileURLToPath(importMeta.url);
                // From dist/esm/package-json-loader.js to package.json (go up 2 levels)
                packageJsonPath = path.resolve(path.dirname(filePath), '..', '..', 'package.json');
            } else {
                throw new Error('import.meta not available');
            }
        } catch (e) {
            // Fallback - try to find package.json relative to current working directory
            const cwd = process.cwd();
            packageJsonPath = path.resolve(cwd, 'package.json');
        }
    }
    const content = fs.readFileSync(packageJsonPath, 'utf8');
    packageJson = JSON.parse(content);
    return packageJson;
}

export const packageJsonData = loadPackageJson();

