#!/usr/bin/env bash

############################################################

export SUMAN_DEBUG=s
echo "NODE_PATH => $NODE_PATH"
cd # cd to home dir
mkdir suman-test
cd suman-test &&
rm -rf suman-test-projects &&
#git clone git@github.com:sumanjs/suman-test-projects.git &&
git clone https://github.com/sumanjs/suman-test-projects.git &&
cd suman-test-projects &&
git checkout -b test_branch &&
echo "installing suman deps locally"
SUMAN_POSTINSTALL_IS_DAEMON=yes npm install --progress=false --loglevel=warn &&
echo "args => $@"
suman --groups $@

##############################################################

EXIT=$?
echo " => bash exit code for script '$(dirname "$0")/$(basename "$0")' => $EXIT" &&
exit ${EXIT}
