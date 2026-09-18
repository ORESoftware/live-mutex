#!/usr/bin/env node
/**
 * ores-lint :: require-send (Rust, Dart, Gleam)
 *
 * House rule, same contract as ores/require-send in ESLint: a logging chain
 * that reaches a level method must be delivered with send() / send(boolean) /
 * send_with_store(...). TypeScript stays on ESLint; this file covers the
 * languages ESLint cannot parse.
 *
 * Line-level overrides (any of these, on the finding line or the previous line):
 *   ores-lint-disable-next-line require-send
 *   ores-lint-disable-line require-send
 * File-level:
 *   ores-lint-disable-file require-send
 *
 * Warn-only. Prints the same capped report format as rust.sh / js.sh.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.argv[2] ? process.argv[2] : process.cwd();
const DIR = dirname(new URL(import.meta.url).pathname);
const MAX = Math.max(1, Number(process.env.ORES_LINT_MAX_EXAMPLES || 5));
const INCLUDE_TESTS = process.env.ORES_LINT_REQUIRE_SEND_INCLUDE_TESTS === '1';
const LEVEL = new Set(['trace', 'debug', 'info', 'log', 'warn', 'error', 'fatal']);
const TERMINAL = new Set(['send', 'send_with_store']);
const SKIP_DIR = new Set([
  'node_modules', 'target', 'dist', 'build', 'out', 'vendor', 'coverage',
  '.git', '.worktrees', '_to_delete', '.next', '.ores-lint', '.vendor',
  'deps', 'third_party', 'thirdparty', 'external', 'submodules', '.r2g',
]);
const TEST_RE = /(?:^|\/)(?:test|tests|spec)\/|_test\.(?:dart|gleam|rs)$|\.test\.|\.spec\./i;

function nestedRepos() {
  try {
    const raw = JSON.parse(readFileSync(join(DIR, 'nested-repos.json'), 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function trackedFiles() {
  let output;
  try {
    output = execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], {
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    }).toString('utf8');
  } catch {
    return [];
  }
  const nested = nestedRepos();
  return output.split('\0').filter(Boolean).filter((rel) => {
    if (!/\.(?:rs|dart|gleam)$/.test(rel)) return false;
    const parts = rel.split('/');
    if (parts.some((p) => SKIP_DIR.has(p))) return false;
    if (nested.some((n) => rel === n || rel.startsWith(`${n}/`))) return false;
    if (!INCLUDE_TESTS && TEST_RE.test(rel)) return false;
    return true;
  });
}

function looksLikeLogger(name) {
  if (!name) return false;
  const base = String(name).split('.').pop();
  return (
    /^(?:log|logger|ddlog|telemetry|audit|self|this)$/i.test(base)
    || /logger$/i.test(base)
    || /(?:^|_)log$/i.test(base)
  );
}

function isDisabled(suppressions, line) {
  if (suppressions.file) return true;
  if (suppressions.lines.has(line) || suppressions.lines.has(line - 1)) return true;
  if (suppressions.next.has(line - 1)) return true;
  return false;
}

function collectSuppressions(source) {
  const file = /ores-lint-disable-file\s+require-send/.test(source);
  const lines = new Set();
  const next = new Set();
  const raw = source.split('\n');
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (/ores-lint-disable-line\s+require-send/.test(line) || /eslint-disable-line\s+ores\/require-send/.test(line)) {
      lines.add(i + 1);
    }
    if (/ores-lint-disable-next-line\s+require-send/.test(line) || /eslint-disable-next-line\s+ores\/require-send/.test(line)) {
      next.add(i + 1);
    }
  }
  return { file, lines, next };
}

function tokenize(source) {
  const tokens = [];
  const n = source.length;
  let i = 0;
  let line = 1;
  let col = 1;
  const push = (type, value, startLine, startCol) => {
    tokens.push({ type, value, line: startLine, col: startCol });
  };
  const bump = (ch) => {
    if (ch === '\n') { line += 1; col = 1; } else col += 1;
  };

  while (i < n) {
    const ch = source[i];
    const startLine = line;
    const startCol = col;

    if (ch === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') { bump(source[i]); i += 1; }
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2; bump('/'); bump('*');
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) { bump(source[i]); i += 1; }
      if (i < n) { bump('*'); bump('/'); i += 2; }
      continue;
    }
    if (ch === '#') {
      // Gleam does not use # comments; rust raw strings / dart interpolations
      // are handled as identifiers or other. Treat # as other.
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      bump(ch); i += 1;
      while (i < n && source[i] !== q) {
        if (source[i] === '\\' && i + 1 < n) { bump(source[i]); bump(source[i + 1]); i += 2; continue; }
        if (source[i] === '\n' && q !== '`') break;
        bump(source[i]); i += 1;
      }
      if (i < n && source[i] === q) { bump(q); i += 1; }
      push('string', '', startLine, startCol);
      continue;
    }
    if (/\s/.test(ch)) {
      bump(ch); i += 1;
      continue;
    }
    if (ch === '|' && source[i + 1] === '>') {
      push('pipe', '|>', startLine, startCol);
      bump('|'); bump('>'); i += 2;
      continue;
    }
    if (ch === '=' && source[i + 1] === '>') {
      push('arrow', '=>', startLine, startCol);
      bump('='); bump('>'); i += 2;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let value = '';
      while (i < n && /[A-Za-z0-9_]/.test(source[i])) { value += source[i]; bump(source[i]); i += 1; }
      push('ident', value, startLine, startCol);
      continue;
    }
    const singles = {
      '.': 'dot', '(': 'lparen', ')': 'rparen', '[': 'lbracket', ']': 'rbracket',
      '{': 'lbrace', '}': 'rbrace', ';': 'semi', ',': 'comma', '=': 'eq',
    };
    if (singles[ch]) {
      push(singles[ch], ch, startLine, startCol);
      bump(ch); i += 1;
      continue;
    }
    bump(ch); i += 1;
  }
  return tokens;
}

function skipBalanced(tokens, start, open, close) {
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].type === open) depth += 1;
    else if (tokens[i].type === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return tokens.length - 1;
}

function qualifiedName(tokens, index) {
  // Walk left across ident.ident
  let i = index;
  if (!tokens[i] || tokens[i].type !== 'ident') return { name: '', start: index };
  let name = tokens[i].value;
  while (i >= 2 && tokens[i - 1].type === 'dot' && tokens[i - 2].type === 'ident') {
    name = `${tokens[i - 2].value}.${name}`;
    i -= 2;
  }
  return { name, start: i };
}

function countTopLevelArgs(tokens, lparenIndex) {
  if (tokens[lparenIndex]?.type !== 'lparen') return 0;
  let depth = 0;
  let args = 0;
  let seen = false;
  for (let i = lparenIndex; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'lparen' || t.type === 'lbracket' || t.type === 'lbrace') depth += 1;
    else if (t.type === 'rparen' || t.type === 'rbracket' || t.type === 'rbrace') {
      depth -= 1;
      if (depth === 0) return seen ? args + 1 : 0;
    } else if (depth === 1 && t.type === 'comma') args += 1;
    else if (depth === 1 && t.type !== 'comma') seen = true;
  }
  return seen ? args + 1 : 0;
}

function walkMethodChain(tokens, start) {
  // start at the root ident of `root.level(args).more(args)`
  const methods = [];
  let i = start;
  if (!tokens[i] || tokens[i].type !== 'ident') return null;
  while (i + 2 < tokens.length && tokens[i + 1].type === 'dot' && tokens[i + 2].type === 'ident' && tokens[i + 3]?.type !== 'lparen') {
    if (LEVEL.has(tokens[i + 2].value) || TERMINAL.has(tokens[i + 2].value)) break;
    i += 2;
  }
  const root = qualifiedName(tokens, i).name;
  let firstArgCount = 0;
  while (i + 2 < tokens.length && tokens[i + 1].type === 'dot' && tokens[i + 2].type === 'ident') {
    const method = tokens[i + 2].value;
    methods.push(method);
    i += 2;
    if (tokens[i + 1]?.type === 'lparen') {
      if (methods.length === 1) firstArgCount = countTopLevelArgs(tokens, i + 1);
      i = skipBalanced(tokens, i + 1, 'lparen', 'rparen');
    }
  }
  return { root, methods, end: i, line: tokens[start].line, firstArgCount };
}

function walkGleamPipe(tokens, start) {
  // start at ident of a call: `logging.info(...)` or `info(...)`
  if (!tokens[start] || tokens[start].type !== 'ident') return null;
  const head = qualifiedName(tokens, start);
  let i = start;
  while (i + 1 < tokens.length && tokens[i + 1].type === 'dot' && tokens[i + 2]?.type === 'ident') i += 2;
  const callee = qualifiedName(tokens, i).name;
  const calleeBase = callee.split('.').pop();
  if (tokens[i + 1]?.type !== 'lparen') {
    // Bare `|> send` / `|> logging.send` only — not type variables named `error`.
    if (TERMINAL.has(calleeBase) && tokens[head.start - 1]?.type === 'pipe') {
      return { callee, methods: [calleeBase], end: i, line: tokens[head.start].line };
    }
    return null;
  }
  const methods = [calleeBase];
  i = skipBalanced(tokens, i + 1, 'lparen', 'rparen');
  while (tokens[i + 1]?.type === 'pipe') {
    i += 1;
    if (tokens[i + 1]?.type !== 'ident') break;
    i += 1;
    while (i + 1 < tokens.length && tokens[i + 1].type === 'dot' && tokens[i + 2]?.type === 'ident') i += 2;
    const step = tokens[i].value;
    methods.push(step);
    if (tokens[i + 1]?.type === 'lparen') i = skipBalanced(tokens, i + 1, 'lparen', 'rparen');
  }
  return { callee, methods, end: i, line: tokens[head.start].line };
}

function precedingAssignment(tokens, start) {
  // `let name =` or `final name =` or `var name =` immediately before start
  let i = start - 1;
  if (tokens[i]?.type !== 'eq') return null;
  i -= 1;
  if (tokens[i]?.type !== 'ident') return null;
  const name = tokens[i].value;
  const prev = tokens[i - 1]?.value;
  if (prev && /^(let|var|final|const|mut)$/.test(prev)) return name;
  // dart `LogEvent event =` / rust `let mut event =` already handled via let
  if (tokens[i - 1]?.type === 'ident') return name;
  return name;
}

function isReturnish(tokens, start) {
  const prev = tokens[start - 1];
  if (!prev) return false;
  if (prev.type === 'arrow') return true;
  if (prev.type === 'ident' && prev.value === 'return') return true;
  return false;
}

function nextNonChainIsSemi(tokens, end) {
  const t = tokens[end + 1];
  return t?.type === 'semi';
}

export function analyzeSource(source, language) {
  const suppressions = collectSuppressions(source);
  const tokens = tokenize(source);
  const findings = [];
  const pending = new Map();
  const scopeStack = [pending];

  const current = () => scopeStack[scopeStack.length - 1];
  const mark = (name, finding) => { if (name) current().set(name, finding); };
  const clear = (name) => {
    if (!name) return;
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      if (scopeStack[i].has(name)) { scopeStack[i].delete(name); return; }
    }
  };
  const report = (finding) => {
    if (isDisabled(suppressions, finding.line)) return;
    findings.push(finding);
  };
  const flushScope = (map) => {
    for (const finding of map.values()) report(finding);
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === 'lbrace') { scopeStack.push(new Map()); continue; }
    if (tok.type === 'rbrace') {
      if (scopeStack.length > 1) flushScope(scopeStack.pop());
      continue;
    }

    // `name.send(...)` or `send(name)` / `logging.send(name)`
    if (tok.type === 'ident' && TERMINAL.has(tok.value)) {
      const prev = tokens[i - 1];
      if (prev?.type === 'dot' && tokens[i - 2]?.type === 'ident') {
        clear(qualifiedName(tokens, i - 2).name);
      }
      if (tokens[i + 1]?.type === 'lparen') {
        const inner = tokens[i + 2];
        if (inner?.type === 'ident') clear(inner.value);
      }
    }

    if (tok.type !== 'ident') continue;

    if (language === 'gleam') {
      const calleeBase = tok.value;
      const isLevel = LEVEL.has(calleeBase);
      if (!isLevel) continue;
      if (tokens[i - 1]?.type === 'ident' && tokens[i - 1].value === 'fn') continue;
      const qual = qualifiedName(tokens, i);
      if (tokens[i + 1]?.type !== 'lparen' && tokens[qual.start - 1]?.type !== 'pipe') continue;
      const pipe = walkGleamPipe(tokens, qual.start);
      if (!pipe) continue;
      if (!pipe.methods.some((m) => LEVEL.has(m))) continue;
      if (pipe.methods.some((m) => TERMINAL.has(m))) {
        i = pipe.end;
        continue;
      }
      const assigned = precedingAssignment(tokens, qual.start);
      const finding = { line: pipe.line, col: tok.col, message: 'logging chain never calls send()' };
      const prev = tokens[qual.start - 1]?.type;
      const next = tokens[pipe.end + 1]?.type;
      if (assigned) mark(assigned, finding);
      else if (isReturnish(tokens, qual.start) || prev === 'lparen' || prev === 'comma' || next === 'rbrace') { /* handoff / tail return */ }
      else report(finding);
      i = pipe.end;
      continue;
    }

    // Rust / Dart method chains: look for `.level(`
    if (tok.type === 'ident' && LEVEL.has(tok.value) && tokens[i - 1]?.type === 'dot' && tokens[i + 1]?.type === 'lparen') {
      let rootIndex = i - 2;
      while (rootIndex >= 2 && tokens[rootIndex]?.type === 'ident' && tokens[rootIndex - 1]?.type === 'dot' && tokens[rootIndex - 2]?.type === 'ident') {
        rootIndex -= 2;
      }
      if (tokens[rootIndex]?.type !== 'ident') continue;
      const chain = walkMethodChain(tokens, rootIndex);
      if (!chain) continue;
      if (!looksLikeLogger(chain.root) && chain.root !== 'self' && chain.root !== 'this') continue;
      if (!chain.methods.some((m) => LEVEL.has(m))) continue;
      if (chain.methods.some((m) => TERMINAL.has(m))) {
        i = chain.end;
        continue;
      }
      // Convenience emit: logger.log(level, msg, ctx, fields) already calls send()
      // internally. The chainable API is one argument (or two in Dart).
      if (chain.methods.length === 1 && (chain.firstArgCount || 0) >= 3) {
        i = chain.end;
        continue;
      }
      const assignName = precedingAssignment(tokens, rootIndex);
      const finding = { line: chain.line, col: tokens[rootIndex].col, message: 'logging chain never calls send()' };
      const prev = tokens[rootIndex - 1]?.type;
      if (assignName) mark(assignName, finding);
      else if (isReturnish(tokens, rootIndex) || prev === 'lparen' || prev === 'comma') { /* handoff */ }
      else if (language === 'rust' && !nextNonChainIsSemi(tokens, chain.end)) { /* rust tail expression / return */ }
      else report(finding);
      i = chain.end;
    }
  }

  while (scopeStack.length) flushScope(scopeStack.pop());
  return findings;
}

export function formatReport(results) {
  const all = [];
  for (const { file, findings } of results) {
    for (const f of findings) all.push({ ...f, file });
  }
  if (!all.length) {
    return results.length
      ? `ores-lint[require-send]: clean (${results.length} file${results.length === 1 ? '' : 's'} scanned)\n`
      : 'ores-lint[require-send]: no Rust/Dart/Gleam source to scan\n';
  }
  const lines = [
    `ores-lint[require-send]: ${all.length} finding(s) across 1 rule(s) in ${results.filter((r) => r.findings.length).length} file(s)`,
    '',
    '  warning: logging chain never delivered (ores custom rule)  [require-send]',
    `    ${all.length} instance(s); showing ${Math.min(all.length, MAX)}:`,
  ];
  for (const f of all.slice(0, MAX)) {
    lines.push(`      ${f.file}:${f.line}:${f.col}`);
  }
  if (all.length > MAX) lines.push(`      ... and ${all.length - MAX} more`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  if (process.env.ORES_LINT_SKIP_REQUIRE_SEND === '1') {
    process.stdout.write('ores-lint[require-send]: skipped (ORES_LINT_SKIP_REQUIRE_SEND=1)\n');
    return;
  }
  const files = trackedFiles();
  const results = [];
  for (const rel of files) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    let source;
    try { source = readFileSync(abs, 'utf8'); } catch { continue; }
    const language = rel.endsWith('.gleam') ? 'gleam' : rel.endsWith('.dart') ? 'dart' : 'rust';
    results.push({ file: rel, findings: analyzeSource(source, language) });
  }
  process.stdout.write(formatReport(results));
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('require-send.mjs')) {
  main();
}
