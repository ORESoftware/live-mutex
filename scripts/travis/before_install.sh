#!/usr/bin/env bash

npm install -g typescript

npm install      \
    "@types/async"  \
    "@types/core-js" \
    "@types/lodash"  \
    "@types/node"

tsc || echo "whatever"