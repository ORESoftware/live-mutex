# Code style

This repository follows the canonical ORE Software code-style policy:

https://github.com/ORESoftware/my-ai/blob/dev/code-style-guide.md

The rules are normative for production code, tests, scripts, and future changes.

Key expectations:

- always use explicit blocks for `if`, `else`, `for`, `while`, `try`, and `catch`;
- never compress control flow merely to save lines;
- prefer early returns over deep nesting;
- prefer immutable values and functional transformations where they improve clarity;
- keep concise expression lambdas/closures concise when they are simple transformations;
- preserve and rethrow original errors when appropriate instead of throwing strings.

The repository ESLint configuration enables `curly: ['warn', 'all']` so block-style regressions are surfaced by `npm run lint:ores`.
