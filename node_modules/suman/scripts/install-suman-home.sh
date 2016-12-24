#!/usr/bin/env bash


YARN=$(which yarn)


if [ -z "${YARN}" ]; then
#    npm install -g yarn &&
    if [ ! -z "${SUMAN_DEBUG}" ]; then  echo "need SUDO to install yarn installed successfully" ; fi
else
    if [ ! -z "${SUMAN_DEBUG}" ]; then  echo "yarn already installed here => $YARN" ; fi
fi


# if BASE_DIRECTORY is not /home or /users, we are global
BASE_DIRECTORY=$(echo "$PWD" | cut -d "/" -f2)

if [ ! -z "${SUMAN_DEBUG}" ]; then echo "BASE_DIRECTORY of PWD => $BASE_DIRECTORY" ; fi

LOG_PATH=~/.suman/suman-debug.log
node $(dirname "$0")/install-optional-deps.js

#cd ~/.suman && npm update --progress=false --loglevel=silent suman-home@latest > ${LOG_PATH} 2>&1
#cd ~/.suman/ && yarn add suman-home > ${LOG_PATH}  2>&1

#echo "suman-home install happening in background" > ${DEBUG_LOG_PATH} &
