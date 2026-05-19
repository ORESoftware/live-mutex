#!/usr/bin/env bash

echo "we are running @run.sh => suman-run-plugins/plugins/typescript-std => $0"

WHICH_SUMAN=$(which suman);

if [[ -z "${WHICH_SUMAN}" ]]; then
   npm install -g suman
fi

if [[ -n ${SUMAN_CHILD_TEST_PATH} ]]; then

#    SUMAN_TARGET="${SUMAN_CHILD_TEST_PATH//@src/@target}"
#    SUMAN_RUNNABLE=${SUMAN_TARGET%.*}.js
#    echo "SUMAN_RUNNABLE => ${SUMAN_RUNNABLE}"
#    echo "node version => $(node -v)"
#    node ${SUMAN_RUNNABLE} | tee -a run.log

    SUMAN_TARGET="${SUMAN_CHILD_TEST_PATH//@src/@target}"

    dn=$(dirname "SUMAN_TARGET");

    echo "dn => $dn" 2>&1;

#    mkdir -p "";
    SUMAN_RUNNABLE=${SUMAN_TARGET%.*}.js
    echo "SUMAN_RUNNABLE => ${SUMAN_RUNNABLE}"
    echo "node version => $(node -v)"
    SUMAN_CHILD_TEST_PATH=${SUMAN_RUNNABLE} node ${SUMAN_RUN_CHILD_STATIC_PATH} # | tee -a run.log

else

  echo "running suman test paths...";

    # TODO: chmod -R 777 $(pwd)/@target
   suman --runner --inherit-stdio --test-paths-json="${SUMAN_TEST_PATHS}" \
   --replace-match="/@src/" --replace-with="/@target/" --replace-ext-with=".js"

fi

EXIT_CODE=$?;
echo "EXIT_CODE => $EXIT_CODE"
exit ${EXIT_CODE};

