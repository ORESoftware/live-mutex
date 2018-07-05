#!/usr/bin/env bash


if [[ ! -d "node_modules" ]]; then
    echo "error: node_modules directory is not present...run npm install as needed.";
    exit 1;
fi

lib_name="live-mutex";

which_suman_tools="$(which suman-tools)";

# with the PATH set, we can pick up local NPM executables
export PATH=${PATH}:"$(pwd)/node_modules/.bin"

if [[ -z ${which_suman_tools} ]]; then
    npm install -g suman-tools;
fi

IS_GLOBALLY_SYMLINKED=`suman-tools --is-symlinked-globally="${lib_name}"`
IS_LOCALLY_SYMLINKED=`suman-tools --is-symlinked-locally="${lib_name}"`

if [[ ${IS_GLOBALLY_SYMLINKED} != *"affirmative"* ]]; then
    npm link # create a global symlink for this library, so that we can create a local symlink
fi

if [[ ${IS_LOCALLY_SYMLINKED} != *"affirmative"* || ${IS_GLOBALLY_SYMLINKED} != *"affirmative"* ]]; then
    npm link "${lib_name}" # create a global symlink for this library, so that we can create a local symlink
fi


npm install -g suman@1.1.51243:


echo "linking global suman to local node_modules...";
npm link suman

suman -- #coverage test/@src/*.ts # --inherit-all-stdio #--inherit-stdio
