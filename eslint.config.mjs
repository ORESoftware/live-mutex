// ores-lint house ESLint config.
// Managed by .ores-lint/ - see .ores-lint/README.md before editing.
// Repo-specific tweaks go in the options object below; the rollout script will
// not overwrite this file once you have changed it.
import oresConfig from './.ores-lint/eslint/base.mjs';

const baseConfig = await oresConfig({
  rules: {
    curly: ['warn', 'all'],
  },
});

export default [
  ...baseConfig,
  {
    files: [
      'src/**/*.ts',
      'test/**/*.ts',
      'formal/**/*.mjs',
      'scripts/**/*.js',
      'clients/**/*.js',
      'clients/**/*.mjs',
      'clients/**/*.ts',
      'clients/**/*.tsx',
    ],
    rules: {
      'max-statements-per-line': ['warn', {max: 1}],
    },
  },
];
