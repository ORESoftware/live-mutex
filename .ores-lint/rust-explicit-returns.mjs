#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || '.');
const MAX_DEPTH = Number(process.env.ORES_LINT_DEPTH || 5);
const INCLUDE_ALL_TARGETS = process.env.ORES_LINT_RUST_ALL_TARGETS === '1';

const EXCLUDED_DIRS = new Set([
  '.git',
  '.ores-lint',
  '.vendor',
  '.worktrees',
  '_to_delete',
  'build',
  'dist',
  'node_modules',
  'target',
  'vendor',
]);

function normalizeRel(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function loadNestedRepos() {
  const file = path.join(ROOT, '.ores-lint', 'nested-repos.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((value) => normalizeRel(String(value))).filter(Boolean);
  } catch {
    return [];
  }
}

const NESTED_REPOS = loadNestedRepos();

function isNestedRepo(rel) {
  const normalized = normalizeRel(rel);
  return NESTED_REPOS.some((nested) => normalized === nested || normalized.startsWith(nested + '/'));
}

function discoverCrates() {
  const crates = [];

  function walk(dir, depth) {
    if (depth > MAX_DEPTH) {
      return;
    }

    const rel = normalizeRel(path.relative(ROOT, dir));
    if (rel && isNestedRepo(rel)) {
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    if (entries.some((entry) => entry.isFile() && entry.name === 'Cargo.toml')) {
      crates.push(dir);
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      walk(path.join(dir, entry.name), depth + 1);
    }
  }

  walk(ROOT, 0);
  return [...new Set(crates)];
}

function collectRustFiles(crateRoots) {
  const files = new Set();

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.rs')) {
        files.add(path.join(dir, entry.name));
      }
    }
  }

  for (const crateRoot of crateRoots) {
    const targets = ['src'];
    if (INCLUDE_ALL_TARGETS) {
      targets.push('tests', 'benches', 'examples');
    }

    for (const target of targets) {
      const dir = path.join(crateRoot, target);
      if (fs.existsSync(dir)) {
        walk(dir);
      }
    }
  }

  return [...files].sort();
}

function isIdentifierChar(ch) {
  return Boolean(ch && /[A-Za-z0-9_]/.test(ch));
}

function skipLineComment(source, index) {
  const end = source.indexOf('\n', index + 2);
  return end === -1 ? source.length : end + 1;
}

function skipBlockComment(source, index) {
  let depth = 1;
  let cursor = index + 2;

  while (cursor < source.length && depth > 0) {
    if (source[cursor] === '/' && source[cursor + 1] === '*') {
      depth += 1;
      cursor += 2;
      continue;
    }

    if (source[cursor] === '*' && source[cursor + 1] === '/') {
      depth -= 1;
      cursor += 2;
      continue;
    }

    cursor += 1;
  }

  return cursor;
}

function skipQuotedString(source, index) {
  let cursor = index + 1;

  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
      continue;
    }

    if (source[cursor] === '"') {
      return cursor + 1;
    }

    cursor += 1;
  }

  return source.length;
}

function skipCharLiteral(source, index) {
  let cursor = index + 1;

  if (cursor >= source.length) {
    return null;
  }

  if (source[cursor] === '\\') {
    cursor += 2;
    while (cursor < source.length && source[cursor] !== "'" && source[cursor] !== '\n') {
      cursor += 1;
    }
    return source[cursor] === "'" ? cursor + 1 : null;
  }

  const close = source.indexOf("'", cursor + 1);
  if (close !== -1 && close - index <= 12 && !source.slice(cursor, close).includes('\n')) {
    return close + 1;
  }

  return null;
}

function skipRawString(source, index) {
  let cursor = index;

  if (source[cursor] === 'b' && source[cursor + 1] === 'r') {
    cursor += 1;
  }

  if (source[cursor] !== 'r') {
    return null;
  }

  cursor += 1;
  let hashes = 0;

  while (source[cursor] === '#') {
    hashes += 1;
    cursor += 1;
  }

  if (source[cursor] !== '"') {
    return null;
  }

  const close = '"' + '#'.repeat(hashes);
  const end = source.indexOf(close, cursor + 1);
  return end === -1 ? source.length : end + close.length;
}

function skipLiteralOrComment(source, index) {
  if (source[index] === '/' && source[index + 1] === '/') {
    return skipLineComment(source, index);
  }

  if (source[index] === '/' && source[index + 1] === '*') {
    return skipBlockComment(source, index);
  }

  const rawEnd = skipRawString(source, index);
  if (rawEnd) {
    return rawEnd;
  }

  if (source[index] === 'b' && source[index + 1] === '"') {
    return skipQuotedString(source, index + 1);
  }

  if (source[index] === '"') {
    return skipQuotedString(source, index);
  }

  if (source[index] === "'") {
    return skipCharLiteral(source, index);
  }

  return null;
}

function skipTrivia(source, index, end = source.length) {
  let cursor = index;

  while (cursor < end) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }

    if (source[cursor] === '/' && source[cursor + 1] === '/') {
      cursor = skipLineComment(source, cursor);
      continue;
    }

    if (source[cursor] === '/' && source[cursor + 1] === '*') {
      cursor = skipBlockComment(source, cursor);
      continue;
    }

    break;
  }

  return cursor;
}

function matchDelimited(source, openIndex, openChar, closeChar, end = source.length) {
  let depth = 1;
  let cursor = openIndex + 1;

  while (cursor < end) {
    const skipped = skipLiteralOrComment(source, cursor);
    if (skipped) {
      cursor = skipped;
      continue;
    }

    if (source[cursor] === openChar) {
      depth += 1;
    } else if (source[cursor] === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }

    cursor += 1;
  }

  return -1;
}

function findNamedFunctions(source) {
  const positions = [];
  let cursor = 0;

  while (cursor < source.length) {
    const skipped = skipLiteralOrComment(source, cursor);
    if (skipped) {
      cursor = skipped;
      continue;
    }

    if (
      source[cursor] === 'f' &&
      source[cursor + 1] === 'n' &&
      !isIdentifierChar(source[cursor - 1]) &&
      !isIdentifierChar(source[cursor + 2])
    ) {
      const nameStart = skipTrivia(source, cursor + 2);
      if (/[A-Za-z_]/.test(source[nameStart] || '')) {
        positions.push(cursor);
      }
      cursor = nameStart + 1;
      continue;
    }

    cursor += 1;
  }

  return positions;
}

function findBodyOpen(source, fnIndex) {
  let parens = 0;
  let brackets = 0;
  let angles = 0;
  let cursor = fnIndex + 2;

  while (cursor < source.length) {
    const skipped = skipLiteralOrComment(source, cursor);
    if (skipped) {
      cursor = skipped;
      continue;
    }

    const ch = source[cursor];

    if (ch === '(') {
      parens += 1;
    } else if (ch === ')') {
      parens = Math.max(0, parens - 1);
    } else if (ch === '[') {
      brackets += 1;
    } else if (ch === ']') {
      brackets = Math.max(0, brackets - 1);
    } else if (ch === '<') {
      angles += 1;
    } else if (ch === '>') {
      angles = Math.max(0, angles - 1);
    } else if (ch === ';' && parens === 0 && brackets === 0 && angles === 0) {
      return -1;
    } else if (ch === '{' && parens === 0 && brackets === 0 && angles === 0) {
      return cursor;
    }

    cursor += 1;
  }

  return -1;
}

function getReturnType(source, fnIndex, bodyOpen) {
  const paramsOpen = source.indexOf('(', fnIndex + 2);
  if (paramsOpen === -1 || paramsOpen > bodyOpen) {
    return null;
  }

  const paramsClose = matchDelimited(source, paramsOpen, '(', ')', bodyOpen);
  if (paramsClose === -1) {
    return null;
  }

  let signatureTail = source.slice(paramsClose + 1, bodyOpen);
  const whereMatch = signatureTail.match(/\bwhere\b/);
  if (whereMatch) {
    signatureTail = signatureTail.slice(0, whereMatch.index);
  }

  const arrow = signatureTail.indexOf('->');
  if (arrow === -1) {
    return null;
  }

  return signatureTail.slice(arrow + 2).trim();
}

function isContinuation(source, index) {
  const ch = source[index];
  if (!ch) {
    return false;
  }

  if ('.?;,:)]}+-*/%&|^!=<>'.includes(ch)) {
    return true;
  }

  return /^(else|as|await)\b/.test(source.slice(index));
}

function findTailExpression(body) {
  let cursor = skipTrivia(body, 0);
  if (cursor >= body.length) {
    return null;
  }

  let statementStart = cursor;
  let braces = 0;
  let parens = 0;
  let brackets = 0;
  let lastCodeEnd = cursor;

  while (cursor < body.length) {
    if (/\s/.test(body[cursor])) {
      cursor += 1;
      continue;
    }

    const skipped = skipLiteralOrComment(body, cursor);
    if (skipped) {
      lastCodeEnd = skipped;
      cursor = skipped;
      continue;
    }

    const ch = body[cursor];

    if (ch === '(') {
      parens += 1;
    } else if (ch === ')') {
      parens = Math.max(0, parens - 1);
    } else if (ch === '[') {
      brackets += 1;
    } else if (ch === ']') {
      brackets = Math.max(0, brackets - 1);
    } else if (ch === '{') {
      braces += 1;
    } else if (ch === '}') {
      braces = Math.max(0, braces - 1);

      if (braces === 0 && parens === 0 && brackets === 0) {
        const next = skipTrivia(body, cursor + 1);
        if (next < body.length && !isContinuation(body, next)) {
          statementStart = next;
        }
      }
    } else if (ch === ';' && braces === 0 && parens === 0 && brackets === 0) {
      const next = skipTrivia(body, cursor + 1);
      if (next < body.length) {
        statementStart = next;
      }
    }

    lastCodeEnd = cursor + 1;
    cursor += 1;
  }

  statementStart = skipTrivia(body, statementStart);
  if (statementStart >= lastCodeEnd) {
    return null;
  }

  return {
    start: statementStart,
    end: lastCodeEnd,
    text: body.slice(statementStart, lastCodeEnd),
  };
}

function getName(source, fnIndex) {
  const start = skipTrivia(source, fnIndex + 2);
  const match = source.slice(start).match(/^([A-Za-z_][A-Za-z0-9_]*)/);
  return match ? match[1] : '<unknown>';
}

function lineAndColumn(source, index) {
  const before = source.slice(0, index);
  const line = before.split('\n').length;
  const lastNewline = before.lastIndexOf('\n');
  const column = index - lastNewline;
  return { line, column };
}

function scanFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const findings = [];

  for (const fnIndex of findNamedFunctions(source)) {
    const bodyOpen = findBodyOpen(source, fnIndex);
    if (bodyOpen === -1) {
      continue;
    }

    const bodyClose = matchDelimited(source, bodyOpen, '{', '}');
    if (bodyClose === -1) {
      continue;
    }

    const returnType = getReturnType(source, fnIndex, bodyOpen);
    if (!returnType || returnType === '()' || returnType === '!') {
      continue;
    }

    const tail = findTailExpression(source.slice(bodyOpen + 1, bodyClose));
    if (!tail) {
      continue;
    }

    const tailText = tail.text.trim();
    if (/^return\b/.test(tailText) || /^(loop|while|for)\b/.test(tailText)) {
      continue;
    }

    const absolute = bodyOpen + 1 + tail.start;
    const { line, column } = lineAndColumn(source, absolute);

    findings.push({
      file,
      functionName: getName(source, fnIndex),
      line,
      column,
    });
  }

  return findings;
}

const crates = discoverCrates();
const files = collectRustFiles(crates);
let total = 0;

for (const file of files) {
  const relative = normalizeRel(path.relative(ROOT, file));

  for (const finding of scanFile(file)) {
    total += 1;
    process.stdout.write(
      relative + ':' + finding.line + ':' + finding.column +
      ': warning: missing `return` statement\n'
    );
  }
}

process.exitCode = 0;
