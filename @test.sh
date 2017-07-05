#!/usr/bin/env bash

cd $(dirname "$0");
npm link .
npm link live-mutex

WHICH_SUMAN=$(which suman);

if [[ -z ${WHICH_SUMAN} ]]; then
 npm install -g suman
fi

