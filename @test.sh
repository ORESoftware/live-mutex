#!/usr/bin/env bash

cd $(dirname "$0");

npm link .
npm link live-mutex

WHICH_SUMAN=$(which suman);

if [[ " " ||  -z ${WHICH_SUMAN} ]]; then
 echo "installing suman locally";
 npm install github:sumanjs/suman#master
fi

./node_modules/.bin/suman test/src/*.js

