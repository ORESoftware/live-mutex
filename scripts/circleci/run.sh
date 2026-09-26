#!/usr/bin/env bash

set -euo pipefail

node --version
npm --version

npm ci

echo

npm run compile

echo

./test/setup-test.sh

echo

npx --no-install suman --default | cat

echo

echo "Here is the contents of test/@target:"

echo

ls -a 'test/@target'
