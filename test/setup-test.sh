#!/usr/bin/env bash

set -eo pipefail;
cd "$(dirname "$(dirname "$BASH_SOURCE")")"

rm -rf node_modules
npm i
npm link -f
npm link live-mutex
npm link suman

npm i --no-save 'async@2.6.3'
npm i --no-save 'handlebars@4.1.1'


# "node-redis-warlock": "^0.2.0",
# "redis": "^2.6.3"