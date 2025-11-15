#!/usr/bin/env bash

set -e  # Exit on error

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Check for node_modules
if [[ ! -d "node_modules" ]]; then
    echo "error: node_modules directory is not present...run npm install as needed.";
    exit 1;
fi

lib_name="live-mutex";

export PATH=${PATH}:"$PROJECT_ROOT/node_modules/.bin"

# Run test setup
echo "Setting up test environment..."
./test/setup-test.sh

# Ensure suman is available
if ! which suman &> /dev/null ; then
    echo "Installing suman globally..."
    npm install -g suman@1.1.51244;
fi

# Link suman locally
npm link suman 2>/dev/null || true

# Run tests serially with independent brokers
# maxParallelProcesses is set to 1 in suman.conf.js to ensure serial execution
echo "Running tests serially with independent brokers..."
suman test/@src/*.ts

echo 'all good :) lulz'
