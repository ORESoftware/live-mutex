#!/usr/bin/env bash


cd # cd to home dir
mkdir suman-test
cd suman-test &&
rm -rf suman-installation-test-project &&
# rmdir suman-installation-test-project &&
git clone git@github.com:sumanjs/suman-installation-test-project.git &&
cd suman-installation-test-project &&
npm install -D suman &&
./node_modules/.bin/suman --init &&
npm install &&
npm test &&
./node_modules/.bin/suman --init &&
npm test

