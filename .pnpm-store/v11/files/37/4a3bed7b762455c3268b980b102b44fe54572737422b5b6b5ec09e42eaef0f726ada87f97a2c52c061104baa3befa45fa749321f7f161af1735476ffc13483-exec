#!/usr/bin/env bash

echo "we are running @run.sh => suman-run-plugins/plugins/typescript-std => $0"

WHICH_TSC=$(which tsc);
if [[ -z "${WHICH_TSC}" ]]; then
   npm install -g typescript
fi

WHICH_TS_NODE=$(which ts-node);
if [[ -z "${WHICH_TS_NODE}" ]]; then
   npm install -g ts-node
fi

export TS_NODE_DISABLE_WARNINGS="yes";
export TS_NODE_FAST="yes";

echo "SUMAN_CHILD_TEST_PATH => $SUMAN_CHILD_TEST_PATH"


#DIRNAME_DIR=$($(dirname ${SUMAN_CHILD_TEST_PATH}) && pwd);

#ts-node --ignoreWarnings ${SUMAN_CHILD_TEST_PATH} | tee "$DIRNAME_DIR/$(basename ${SUMAN_CHILD_TEST_PATH})-run.log"

ts-node -D -F "${SUMAN_CHILD_TEST_PATH}";

#echo "$(cat "${SUMAN_CHILD_TEST_PATH}")" | ts-node --ignoreWarnings

EXIT_CODE=$?;
echo "EXIT_CODE => $EXIT_CODE"
exit ${EXIT_CODE};

