#!/usr/bin/env node
'use strict';

/**
 * Post-build script to remove import.meta from CommonJS builds
 * Node.js treats files with import.meta as ESM, so we need to remove it from CommonJS builds
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove ALL import.meta references - replace entire else blocks that use import.meta
    // Pattern 1: utils.js - resolveLaunchBrokerPath function
    content = content.replace(
        /else\s*{\s*const filePath = \(0,\s*url_1\.fileURLToPath\)\(import\.meta\.url\);\s*const dir = path\.dirname\(filePath\);\s*return path\.resolve\(dir,\s*['"]launch-broker-child\.js['"]\);\s*}/g,
        `else {
        // ESM fallback - should not be reached in CommonJS
        throw new Error('ESM code path executed in CommonJS build');
    }`
    );
    
    // Pattern 2: package-json-loader.js - loadPackageJson function
    // Match the entire else block with try-catch and import.meta (multiline, non-greedy)
    // This pattern matches: else { try { ... import.meta ... } catch (e) { ... } }
    content = content.replace(
        /else\s*{\s*try\s*{[\s\S]*?import\.meta[\s\S]*?}\s*catch\s*\([^)]*\)\s*{[\s\S]*?}\s*}/g,
        `else {
        // ESM code removed for CommonJS build
        const cwd = process.cwd();
        packageJsonPath = path.resolve(cwd, 'package.json');
    }`
    );
    
    // Pattern 2b: package-json-loader.js - simpler else block with import.meta (single line)
    content = content.replace(
        /else\s*{\s*const filePath = \(0,\s*url_1\.fileURLToPath\)\(import\.meta\.url\);\s*packageJsonPath = path\.resolve\(path\.dirname\(filePath\),\s*['"]\.\.['"],\s*['"]\.\.['"],\s*['"]package\.json['"]\);\s*}/g,
        `else {
        // ESM path resolution - should not be reached in CommonJS
        const cwd = process.cwd();
        packageJsonPath = path.resolve(cwd, 'package.json');
    }`
    );
    
    // More aggressive: remove any remaining import.meta references
    // Replace any else block that contains import.meta (multiline, balanced braces)
    if (content.includes('import.meta')) {
        // Match else blocks that contain import.meta - need to balance braces
        let braceCount = 0;
        let startPos = -1;
        let inElse = false;
        const lines = content.split('\n');
        const newLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/^\s*else\s*{/)) {
                inElse = true;
                braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
                if (line.includes('import.meta')) {
                    // Replace this else block
                    newLines.push('    else {');
                    newLines.push('        // ESM code removed for CommonJS build');
                    newLines.push('        const cwd = process.cwd();');
                    newLines.push('        packageJsonPath = path.resolve(cwd, \'package.json\');');
                    newLines.push('    }');
                    // Skip lines until we find the matching closing brace
                    while (i < lines.length - 1 && braceCount > 0) {
                        i++;
                        const nextLine = lines[i];
                        braceCount += (nextLine.match(/{/g) || []).length - (nextLine.match(/}/g) || []).length;
                    }
                    inElse = false;
                    continue;
                }
            } else if (inElse) {
                braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
                if (line.includes('import.meta')) {
                    // Found import.meta in else block - need to replace from start
                    // This is complex, use regex fallback instead
                }
                if (braceCount <= 0) {
                    inElse = false;
                }
            }
            if (!inElse || !line.includes('import.meta')) {
                newLines.push(line);
            }
        }
        
        // Fallback to regex if line-by-line didn't work
        if (content.includes('import.meta')) {
            // Match else blocks that span multiple lines and contain import.meta
            // Use a more careful pattern that matches balanced braces
            content = content.replace(
                /else\s*{[\s\S]*?import\.meta[\s\S]*?(?=\n\s*(?:}\s*$|const\s+content))/g,
                `else {
        // ESM code removed for CommonJS build
        const cwd = process.cwd();
        packageJsonPath = path.resolve(cwd, 'package.json');
    }`
            );
        }
    }
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed import.meta in: ${path.relative(process.cwd(), filePath)}`);
    }
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && file !== 'esm' && file !== 'test') {
            processDirectory(filePath);
        } else if (file.endsWith('.js') && !filePath.includes('esm')) {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('import.meta')) {
                fixFile(filePath);
            }
        }
    }
}

if (fs.existsSync(distDir)) {
    console.log('Removing import.meta from CommonJS builds...');
    processDirectory(distDir);
    console.log('Done!');
} else {
    console.error(`Dist directory not found: ${distDir}`);
    process.exit(1);
}

