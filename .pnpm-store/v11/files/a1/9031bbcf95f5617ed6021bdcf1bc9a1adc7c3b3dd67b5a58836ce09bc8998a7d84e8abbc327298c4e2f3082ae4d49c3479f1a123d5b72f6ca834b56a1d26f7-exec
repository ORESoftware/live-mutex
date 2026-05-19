#!/usr/bin/env bash

echo "running transform process, using plugin with name '$(basename `dirname $0`)'.";

which_tsc="$(which tsc)";
if [[ -z ${which_tsc} ]]; then
    npm install -g typescript
fi

which_suman_tools="$(which suman-tools)";
if [[ -z ${which_suman_tools} ]]; then
    npm install -g suman-tools
fi

for x in $(suman-tools --extract-json-array=${SUMAN_TEST_PATHS}); do

    SUMAN_TARGET="${x//@src/@target}"
    SUMAN_TARGET="${SUMAN_TARGET%.*}.js"

    if [[ "${SUMAN_TARGET}" -nt "${x}" ]]; then
        echo "no need to transpile since the transpiled file is ready."
    else
        echo "we must transpile file."
        OUT_DIR="$(dirname $(dirname ${x}))/@target"
        mkdir -p "$OUT_DIR"
        echo "x => $x"
        echo "SUMAN_TARGET => ${SUMAN_TARGET}"
        echo "OUT_DIR => ${OUT_DIR}"
        tsc ${x} --target 'ES6' --module 'CommonJS' --noResolve --outDir "${OUT_DIR}" # > /dev/null
        chmod -R 777 "${OUT_DIR}"
    fi

done