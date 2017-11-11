#!/usr/bin/env bash

set -e;

if [[ ! -d "node_modules" ]]; then
    echo "error: node_modules directory is not present...run npm install as needed.";
    exit 1;
fi

if [[ ! -f "package.json" ]]; then
    echo "error: package file is not present...cannot continue.";
    exit 1;
fi

str="$(cat package.json)"
prop="name"
#my_val="$(node -e "console.log(JSON.parse(${str})[${prop}]);")"

my_val="$(node -pe "JSON.parse(\`$str\`)['name']")"

#my_val="$(node -pe "require('./package.json')['$prop']")"

echo "json val: '$my_val'"

exit 1;

tsc --pretty --experimentalDecorators