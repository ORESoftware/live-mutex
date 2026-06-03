#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const phaseZ = process.argv.includes('--phase-z');
const fixturesDir = path.resolve(__dirname, '../fixtures');
const matrix = require(path.resolve(fixturesDir, 'phase-contract.json'));
const sample = fs.readFileSync(path.resolve(fixturesDir, 'sample-input.txt'), 'utf8');

assert.deepStrictEqual(matrix.phases, ['phase-Z', 'phase-S', 'phase-T']);
assert.deepStrictEqual(matrix.executionOrder, ['phase-Z', 'phase-S', 'phase-T']);
assert.deepStrictEqual(matrix.skipFlags, ['z', 's', 't']);
assert.strictEqual(matrix.phaseCommands.z, 'package.json:r2g.test');
assert.strictEqual(matrix.phaseCommands.s, 'r2gSmokeTest');
assert.strictEqual(matrix.phaseCommands.t, '.r2g/tests');
assert.strictEqual(matrix.features.config, '.r2g/config.js');
assert.strictEqual(matrix.features.customActions, '.r2g/custom.actions.js');
assert.strictEqual(matrix.features.packageOverride, '.r2g/package.override.js');
assert.deepStrictEqual(matrix.features.fullLocalDependencies, [
  '@oresoftware/json-stream-parser',
  '@oresoftware/linked-queue',
  'suman'
]);
assert.match(sample, /fixture-token: r2g-phase-t/);

if (!phaseZ) {
  const markersDir = path.resolve(__dirname, '../.r2g-markers');
  assert.strictEqual(fs.existsSync(path.resolve(markersDir, 'before-install.txt')), true);
  assert.strictEqual(fs.existsSync(path.resolve(markersDir, 'after-install.txt')), true);

  const tempPackageJSON = require(path.resolve(__dirname, '../package.json'));
  assert.strictEqual(tempPackageJSON.r2g.packageOverride, true);
  assert.strictEqual(tempPackageJSON.r2g.packageOverrideSource, '.r2g/package.override.js');

  const pkg = require(matrix.packageName);
  assert.strictEqual(typeof pkg[matrix.smokeExport], 'function');
  assert.strictEqual(pkg[matrix.smokeExport](), true);
}

console.log(`${phaseZ ? 'phase-Z' : 'phase-T'} contract ok for ${matrix.packageName}`);
