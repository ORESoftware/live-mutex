#!/usr/bin/env bash

set -eo pipefail
cd "$(dirname "$(dirname "$BASH_SOURCE")")"

# Build TypeScript first
echo "Building TypeScript..."
tsc || {
    echo "TypeScript build failed!"
    exit 1
}

# Install dependencies if node_modules doesn't exist or is incomplete
if [[ ! -d "node_modules" ]] || [[ ! -f "node_modules/async/package.json" ]]; then
    echo "Installing dependencies..."
    npm i
    
    # Install test dependencies
    npm i --no-save 'async@2.6.3' 'handlebars@4.1.1' || {
        echo "Failed to install test dependencies"
        exit 1
    }
fi

# Ensure dist directory exists and is built
if [[ ! -d "dist" ]] || [[ ! -f "dist/main.js" ]]; then
    echo "Building TypeScript (dist missing)..."
    tsc || {
        echo "TypeScript build failed!"
        exit 1
    }
fi

# Link the package globally
echo "Linking package..."
npm link -f

# Try to link locally (may fail if already linked, that's ok)
npm link live-mutex 2>/dev/null || {
    # If linking fails, try unlinking first then linking
    npm unlink live-mutex 2>/dev/null || true
    npm link live-mutex 2>/dev/null || true
}

# Link suman if available
if command -v suman &> /dev/null; then
    npm link suman 2>/dev/null || true
fi

echo "Test setup complete!"