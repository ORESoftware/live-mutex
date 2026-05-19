#!/usr/bin/env bash

echo "running transform process, using plugin with name '$(dirname $0)'.";

WHICH_SUMAN_TOOLS=$(which suman-tools);
if [[ -z ${WHICH_SUMAN_TOOLS} ]]; then
  npm install -g suman-tools
fi

export PATH=${SUMAN_PROJECT_ROOT}/node_modules/.bin:${PATH}:~/.suman/global/node_modules/.bin

WHICH_BABEL=$(which babel);

if [[ -z ${WHICH_BABEL} ]]; then
   echo "babel could not be found on your PATH";
   exit 1;
fi


for x in $(suman-tools --extract-json-array=${SUMAN_TEST_PATHS}); do

    SUMAN_TARGET="${x//@src/@target}"
    SUMAN_TARGET=${SUMAN_TARGET%.*}.js

    if [[ ${SUMAN_TARGET} -nt ${x} ]]; then
        echo "no need to transpile since the transpiled file is correct."
    else
        echo "we must transpile file."
        SUMAN_FILENAME=$(basename "${x}")
        SUMAN_BABEL_DIR=$(dirname "${x}");
        OUT_DIR="$(dirname $(dirname "${x}"))/@target"
        mkdir -p "${OUT_DIR}"
        (cd "${SUMAN_BABEL_DIR}" && babel "${x}" --out-file "${OUT_DIR}"/"${SUMAN_FILENAME}")
        chmod -R 777 "${OUT_DIR}"
    fi

done