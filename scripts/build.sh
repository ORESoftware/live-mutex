#!/usr/bin/env bash

set -e;

rm -rf node_modules
npm i --loglevel=warn
npm link
nlu run

tsc --watch