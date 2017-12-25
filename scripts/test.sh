#!/usr/bin/env bash


if [[ ! -d "node_modules" ]]; then
    echo "error: node_modules directory is not present...run npm install as needed.";
    exit 1;
fi

LIB_NAME="live-mutex";

WHICH_SUMAN_TOOLS="$(which suman-tools)";

# with the PATH set, we can pick up local NPM executables
export PATH=${PATH}:"$(pwd)/node_modules/.bin"

if [[ -z ${WHICH_SUMAN_TOOLS} ]]; then
    npm install -g suman-tools;
fi

IS_GLOBALLY_SYMLINKED=`suman-tools --is-symlinked-globally="${LIB_NAME}"`
IS_LOCALLY_SYMLINKED=`suman-tools --is-symlinked-locally="${LIB_NAME}"`

if [[ ${IS_GLOBALLY_SYMLINKED} != *"affirmative"* ]]; then
    npm link # create a global symlink for this library, so that we can create a local symlink
fi

if [[ ${IS_LOCALLY_SYMLINKED} != *"affirmative"* || ${IS_GLOBALLY_SYMLINKED} != *"affirmative"* ]]; then
    npm link "${LIB_NAME}" # create a global symlink for this library, so that we can create a local symlink
fi


WHICH_SUMAN="$(which suman)";
if [[ -z ${WHICH_SUMAN} || "${NODE_ENV}" != "local" ]]; then
    echo "installing suman globally...";
    npm install -g suman@latest --silent
fi

echo "linking global suman to local node_modules...";
npm link suman

suman --coverage test/@src/*.ts --inherit-all-stdio #--inherit-stdio
