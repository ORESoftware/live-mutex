#!/usr/bin/env bash

set -eo pipefail
cd "$(dirname "$(dirname "$BASH_SOURCE")")"

rm -rf node_modules
npm i
npm link -f
npm link live-mutex
npm link suman

#npm i --no-save 'async@2.6.3'
#npm i --no-save 'handlebars@4.1.1'

npm link --no-save 'async@2.6.3'
npm link --no-save 'handlebars@4.1.1'

npm link 'node-redis-warlock@^0.2.0'
npm link 'redis@^2.6.3'
