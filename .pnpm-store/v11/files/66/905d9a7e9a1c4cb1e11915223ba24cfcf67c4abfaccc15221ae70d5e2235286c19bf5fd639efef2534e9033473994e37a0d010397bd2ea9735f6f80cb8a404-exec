#!/usr/bin/env bash

set -e;

export SUMAN_DEBUG_LOG_PATH="$HOME/.suman/logs/suman-postinstall-debug.log"
SUMAN_POSTINSTALL_IS_DAEMON=${SUMAN_POSTINSTALL_IS_DAEMON:-no}

mkdir -p "$HOME/.suman" && echo "created suman dir" || { echo " could not create suman dir"; exit 1; }
mkdir -p "$HOME/.suman/logs" && echo "create logs dir" || { echo " could not create logs dir"; exit 1; }
mkdir -p "$HOME/.suman/global" && echo "created global dir" || { echo " could not create global dir"; exit 1; }
mkdir -p "$HOME/.suman/database" && echo "created database dir" || { echo " could not create database dir"; exit 1; }

if [ -e ${SUMAN_DEBUG_LOG_PATH} ]; then
   echo "new install run" > ${SUMAN_DEBUG_LOG_PATH} && echo "created debug log file" \
   || { echo " could not create log file"; exit 1; }
else
   echo "new install run"  >> ${SUMAN_DEBUG_LOG_PATH}  && echo "created debug log file" \
   || { echo " could not create log file"; exit 1; }
fi

SUMAN_START_TIME=$(node -e 'console.log(Date.now())')
SUMAN_DEBUG="$(echo -e "${SUMAN_DEBUG}" | tr -d '[:space:]')"

SUMAN_IN_CONTAINER="no";

if [[ "lxc" == "${container}" ]]; then
    SUMAN_IN_CONTAINER="yes";
     echo " => Suman says => We are in a (Docker) container because of the
        container env var! " | tee -a  ${SUMAN_DEBUG_LOG_PATH}
fi

if [[ -f ~/.dockerenv ]]; then
    SUMAN_IN_CONTAINER="yes";
    echo " => Suman says => We are in a (Docker)
        container because of the presence of .dockerenv file! " | tee -a  ${SUMAN_DEBUG_LOG_PATH}
fi

./scripts/create-suman-dir.js

DOT_SUMAN_DIR=$(cd ~/.suman && pwd)
SUMAN_INSTALL_NODE_MODULES="yes";

if [[ ! -d "$DOT_SUMAN_DIR" ]]; then
    echo " => Warning => Suman failed to create ~/.suman directory." | tee -a  ${SUMAN_DEBUG_LOG_PATH}
    SUMAN_INSTALL_NODE_MODULES="no";
fi

if [[ "${SUMAN_INSTALL_NODE_MODULES}" == "yes" ]]; then


(

  cd "$HOME/.suman/global";
  echo "skipping installation of extra deps..";
  exit 0;

  npm init -f >> ${SUMAN_DEBUG_LOG_PATH} 2>&1

  if [[ ! -d "node_modules/handlebars" ]]; then
    npm install -S handlebars
  fi

  if [[ ! -d "node_modules/typescript" ]]; then
    npm install -S typescript
  fi

  if [[ ! -d "node_modules/ts-node" ]]; then
    npm install -S ts-node
  fi

  if [[ ! -d "node_modules/istanbul" ]]; then
    npm install -S istanbul
  fi

  if [[ ! -d "node_modules/nyc" ]]; then
    npm install -S nyc
  fi

  if [[ ! -d "node_modules/suman-inquirer" ]]; then
    npm install -S suman-inquirer
  fi

  if [[ ! -d "node_modules/suman-inquirer-directory" ]]; then
    npm install -S suman-inquirer-directory
  fi

  if [[ ! -d "node_modules/babel-core" ]]; then
    npm install -S babel-core
  fi

  if [[ ! -d "node_modules/babel-runtime" ]]; then
    npm install -S babel-runtime
  fi

)

fi

SUMAN_END_TIME=$(node -e 'console.log(Date.now())')
SUMAN_TOTAL_TIME=$(expr ${SUMAN_END_TIME} - ${SUMAN_START_TIME})
echo " => Suman => all done with postinstall routine after ${SUMAN_TOTAL_TIME}ms. " | tee -a  ${SUMAN_DEBUG_LOG_PATH}

# explicit for your pleasure
exit 0;
