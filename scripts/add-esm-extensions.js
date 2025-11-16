#!/usr/bin/env node
'use strict';

/**
 * Post-build script to add .js extensions to ESM imports
 * ESM requires explicit file extensions for relative imports
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distEsmDir = path.join(__dirname, '..', 'dist', 'esm');

function addExtensionsToFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Fix package.json imports - they need to go up to project root
    // From dist/esm/ to package.json requires ../../package.json
    content = content.replace(
        /from\s+['"]\.\.\/package\.json['"]/g,
        "from '../../package.json'"
    );
    
    // Replace relative imports without extensions
    // Match: from './something' or from "../something" but not from './something.js' or external packages
    content = content.replace(
        /from\s+['"](\.\.?\/[^'"]+)(?<!\.js)(?<!\.json)['"]/g,
        (match, importPath) => {
            // Check if the file exists with .js extension
            const dir = path.dirname(filePath);
            const fullPath = path.resolve(dir, importPath);
            const jsPath = fullPath + '.js';
            
            if (fs.existsSync(jsPath) || fs.existsSync(fullPath + '.d.ts')) {
                return `from '${importPath}.js'`;
            }
            return match;
        }
    );
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated imports in: ${path.relative(process.cwd(), filePath)}`);
    }
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            processDirectory(filePath);
        } else if (file.endsWith('.js')) {
            addExtensionsToFile(filePath);
        }
    }
}

if (fs.existsSync(distEsmDir)) {
    console.log('Adding .js extensions to ESM imports...');
    processDirectory(distEsmDir);
    console.log('Done!');
} else {
    console.error(`ESM directory not found: ${distEsmDir}`);
    process.exit(1);
}

