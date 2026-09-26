import assert = require('assert');
import * as fs from 'fs';
import * as path from 'path';

const SOURCE_EXTENSIONS = new Set([
  '.rs', '.ts', '.js', '.go', '.dart', '.gleam', '.py', '.cpp', '.cc', '.cxx', '.h', '.hpp',
  '.java', '.erl', '.ex', '.exs', '.ml', '.mli', '.cs', '.fs', '.fsx', '.sh', '.ps1',
]);
const SKIP_DIRS = new Set(['target', 'build', 'dist', 'node_modules', '.git']);

const collectSource = (root: string): { text: string; files: number } => {
  let text = '';
  let files = 0;
  const visit = (entryPath: string): void => {
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(entryPath))) {return;}
      for (const child of fs.readdirSync(entryPath)) {visit(path.join(entryPath, child));}
      return;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entryPath))) {return;}
    text += fs.readFileSync(entryPath, 'utf8') + '\n';
    files += 1;
  };
  visit(root);
  return { text, files };
};

const normalizeAuthoritySurface = (source: string): string =>
  source.toLowerCase().replace(/[^a-z0-9]/g, '');

const clientsRoot = path.join(__dirname, '..', 'clients');
const clientDirs = fs.readdirSync(clientsRoot)
  .map((name) => ({ name, fullPath: path.join(clientsRoot, name) }))
  .filter(({ fullPath }) => fs.statSync(fullPath).isDirectory());

assert.ok(clientDirs.length >= 8, `expected broad polyglot client matrix, found ${clientDirs.length}`);

const noSource: string[] = [];
const missingFencing: string[] = [];
for (const { name, fullPath } of clientDirs) {
  const { text, files } = collectSource(fullPath);
  if (files === 0) {
    noSource.push(name);
    continue;
  }
  if (!normalizeAuthoritySurface(text).includes('fencingtoken')) {missingFencing.push(name);}
}
noSource.sort();
missingFencing.sort();
assert.deepStrictEqual(noSource, [], `client directories with no implementation source: ${noSource.join(', ')}`);
assert.deepStrictEqual(missingFencing, [], `clients that do not expose/preserve a fencing-token field: ${missingFencing.join(', ')}`);
console.log(`formal client fencing surface OK: ${clientDirs.length} client implementations checked`);
