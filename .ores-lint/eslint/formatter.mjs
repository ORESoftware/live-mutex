/**
 * ores-lint :: capped ESLint formatter
 *
 * Same reporting contract as the Rust side: one block per rule, at most
 * ORES_LINT_MAX_EXAMPLES concrete locations, then a count of the remainder.
 * A rollout across hundreds of repos surfaces thousands of missing semicolons;
 * printing every one of them buries the findings that actually matter.
 */

const MAX = Math.max(1, Number(process.env.ORES_LINT_MAX_EXAMPLES || 5));

const LABELS = {
  semi: 'missing semicolon (ores house style)',
  'ores/semi': 'missing semicolon (ores house style)',
  'ores/require-send': 'logging chain never delivered (ores custom rule)',
};

export default function oresFormatter(results) {
  const byRule = new Map();
  let files = 0;
  let errors = 0;
  let warnings = 0;
  const parseErrors = [];

  for (const result of results) {
    if (!result.messages.length) continue;
    files++;
    const rel = (result.filePath || '').replace(`${process.cwd()}/`, '');
    for (const m of result.messages) {
      if (m.severity === 2) errors++; else warnings++;
      if (!m.ruleId) { parseErrors.push(`${rel}:${m.line || 0}: ${m.message}`); continue; }
      let entry = byRule.get(m.ruleId);
      if (!entry) { entry = { count: 0, examples: [], severity: m.severity, message: m.message }; byRule.set(m.ruleId, entry); }
      entry.count++;
      if (entry.examples.length < MAX) entry.examples.push(`${rel}:${m.line}:${m.column}`);
    }
  }

  // Report how many files were actually examined. "clean" and "nothing was
  // linted" are otherwise indistinguishable, which makes a silent coverage gap
  // look like a passing repo - the single most misleading thing a linter can do.
  const examined = results.length;
  if (!byRule.size && !parseErrors.length) {
    return examined === 0
      ? 'ores-lint[js]: no lintable files matched (check ignores / file extensions)\n'
      : `ores-lint[js]: clean (${examined} file${examined === 1 ? '' : 's'} linted)\n`;
  }

  const out = [];
  const total = errors + warnings;
  out.push(`ores-lint[js]: ${total} finding(s) across ${byRule.size} rule(s) in ${files} of ${examined} file(s) linted`);

  // House rules first, then the rest by frequency.
  const ordered = [...byRule.entries()].sort((a, b) => {
    const ah = a[0] in LABELS ? 0 : 1;
    const bh = b[0] in LABELS ? 0 : 1;
    return ah - bh || b[1].count - a[1].count;
  });

  for (const [ruleId, entry] of ordered) {
    const sev = entry.severity === 2 ? 'error' : 'warning';
    const label = LABELS[ruleId] || entry.message;
    out.push('');
    out.push(`  ${sev}: ${label}  [${ruleId}]`);
    out.push(`    ${entry.count} instance(s); showing ${Math.min(entry.count, MAX)}:`);
    for (const ex of entry.examples) out.push(`      ${ex}`);
    if (entry.count > MAX) out.push(`      ... and ${entry.count - MAX} more`);
  }

  if (parseErrors.length) {
    out.push('');
    out.push(`  note: ${parseErrors.length} file(s) could not be parsed (usually a missing parser, not a defect):`);
    for (const p of parseErrors.slice(0, MAX)) out.push(`      ${p}`);
    if (parseErrors.length > MAX) out.push(`      ... and ${parseErrors.length - MAX} more`);
  }

  out.push('');
  return `${out.join('\n')}\n`;
}
