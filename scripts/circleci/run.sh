#!/usr/bin/env bash

set -euo pipefail

node --version
npm --version

# The historical Suman dev dependency pulls sqlite3@3, whose native install
# scripts cannot build on modern Node/V8. live-mutex does not use sqlite3 at
# runtime, so keep the lockfile deterministic while preventing unused
# dependency lifecycle scripts from compiling obsolete native addons.
npm ci --ignore-scripts --no-audit

# This matrix is a Node compatibility gate, not the heavyweight stress suite.
# Prove that maintained source compiles/builds and that the formal + lock-safety
# contracts execute on every supported runtime.
npm run compile:check
npm run build
node formal/model.mjs
node --test test/pr-lock-safety.e2e.test.js
