#!/usr/bin/env bash

set -e;

env | sort;

npm i

echo

tsc

echo

./test/setup-test.sh

echo

suman --default | cat

echo

echo "Here is the contents of test/@target:"

echo

ls -a 'test/@target'