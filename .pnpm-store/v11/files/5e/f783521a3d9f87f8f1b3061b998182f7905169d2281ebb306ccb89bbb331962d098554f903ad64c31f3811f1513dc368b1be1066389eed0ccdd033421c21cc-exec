#!/usr/bin/env bash


if [[ -z ${SUMAN_CHILD_TEST_PATH} ]]; then

    WHICH_SUMAN=$(which suman);

    if [[ -z "${WHICH_SUMAN}" ]]; then
        npm install -g suman
    fi

    echo "running suman test paths...";
    suman --runner --inherit-stdio --test-paths-json="${SUMAN_TEST_PATHS}" --replace-match="/@src/" \
    --replace-with="/@target/" --replace-ext-with=".js"

else

    SUMAN_TARGET="${SUMAN_CHILD_TEST_PATH//@src/@target}"
    SUMAN_TARGET=${SUMAN_TARGET%.*}.js
    echo "SUMAN_TARGET => ${SUMAN_TARGET}"
    echo "node version => $(node -v)"
    #node ${SUMAN_TARGET} | tee -a run.log

    node ${SUMAN_TARGET}

fi

EXIT_CODE=$?;
echo "EXIT_CODE => $EXIT_CODE"
exit ${EXIT_CODE};

