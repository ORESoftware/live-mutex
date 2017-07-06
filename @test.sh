#!/usr/bin/env bash

cd $(dirname "$0");

if [[ ! -d "./node_modules" ]]; then
  echo "error: node_modules directory is not present...run npm install as needed.";
#  exit 1;
fi

LIB_NAME="live-mutex";

WHICH_SUMAN_TOOLS=$(which suman-tools);

export PATH=${PATH}:./node_modules/.bin

if [[ -z ${WHICH_SUMAN_TOOLS} ]]; then
npm install suman-tools;
fi

IS_GLOBALLY_SYMLINKED=`suman-tools --is-symlinked-globally="${LIB_NAME}"`
IS_LOCALLY_SYMLINKED=`suman-tools --is-symlinked-locally="${LIB_NAME}"`

if [[ ${IS_GLOBALLY_SYMLINKED} != *"affirmative"* ]]; then
    npm link # create a global symlink for this library, so that we can create a local symlink
fi

if [[ ${IS_LOCALLY_SYMLINKED} != *"affirmative"* || ${IS_GLOBALLY_SYMLINKED} != *"affirmative"* ]]; then
    npm link "${LIB_NAME}" # create a global symlink for this library, so that we can create a local symlink
fi

WHICH_SUMAN=$(which suman);
if [[ " " || -z ${WHICH_SUMAN} ]]; then
 echo "installing suman locally";
 npm install github:sumanjs/suman#rebase_branch
fi

#suman test/src/*.js --inherit-stdio --force

suman test/src/four.test.js

