#!/usr/bin/env bash

set -euo pipefail

node --version
npm --version

# The historical Suman dev dependency pulls sqlite3@3, whose native install
# scripts cannot build on modern Node/V8. live-mutex does not use sqlite3 at
# runtime, and the maintained test entrypoint is `npm test`, not the legacy
# Suman CLI. Keep the lockfile deterministic while preventing unused dependency
# lifecycle scripts from compiling native addons during CI.
npm ci --ignore-scripts

npm run compile

./test/setup-test.sh

npm test

echo "Here is the contents of test/@target:"
ls -a 'test/@target'
