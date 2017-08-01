#!/usr/bin/env bash

cd $(dirname "$0");

if [[ ! -d "./node_modules" ]]; then
    echo "error: node_modules directory is not present...run npm install as needed.";
fi

LIB_NAME="live-mutex";

WHICH_SUMAN_TOOLS=$(which suman-tools);

# with the PATH set, we can pick up local NPM executables
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
if [[ -z ${WHICH_SUMAN} || "${NODE_ENV}" != "local" ]]; then
    echo "installing suman locally (rebase?)";
    npm install -g github:sumanjs/suman#rebase_branch
fi

suman test/@src/*.ts --inherit-stdio --inherit-all-stdio
