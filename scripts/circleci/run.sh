#!/usr/bin/env bash

set -e;

npm i
tsc
npm link suman
ln -s `pwd` node_modules/live-mutex
suman --default | cat

echo "Whooop"
ls -a 'test/@target'