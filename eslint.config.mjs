// ores-lint house ESLint config.
// Managed by .ores-lint/ - see .ores-lint/README.md before editing.
// Repo-specific tweaks go in the options object below; the rollout script will
// not overwrite this file once you have changed it.
import oresConfig from './.ores-lint/eslint/base.mjs';

export default await oresConfig({
  // requireSend: { loggerNames: ['myLogger'], terminalMethods: ['send', 'flush'] },
  // rules: { 'no-console': 'warn' },
  // ignores: ['**/generated/**'],
});
