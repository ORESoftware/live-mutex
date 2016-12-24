#!/usr/bin/env bash

cd # cd to home dir
mkdir suman-test
cd suman-test &&
git clone https://github.com/ORESoftware/suman &&
cd suman &&
npm install &&
npm test

