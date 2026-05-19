#!/usr/bin/env bash

set -e;

if ! [[ -z "${LOCAL_SUMAN_ALREADY_FOUND+x}" ]]; then
    echo "[suman] => is local suman executable already found? => $LOCAL_SUMAN_ALREADY_FOUND"
fi

if [[ "${SUMAN_WATCH_TEST_RUN}" == "yes" ]]; then
    echo "[suman] Cannot run suman-shell from a watch process.";
    echo "[suman] Cannot run suman-shell from a watch process." >&2;
    exit 1;
fi

echo "[suman] => Original path of Suman executable => \"$0\""
DIRN="$(dirname "$0")";
RL="$(readlink "$0")";
EXECDIR="$(dirname $(dirname "$RL"))";
MYPATH="$DIRN/$EXECDIR";
X="$(cd $(dirname ${MYPATH}) && pwd)/$(basename ${MYPATH})"
NEW_NODE_PATH="${NODE_PATH}:$HOME/.suman/global/node_modules"
NEW_PATH="${PATH}:$HOME/.suman/global/node_modules/.bin"


### append "--suman-shell" as an argument
args=("$@");
args+=("--suman-shell")


if [[ "${LOCAL_SUMAN_ALREADY_FOUND}" == "yes" ]]; then

    # we know that this directory contains the local version of suman we want to use
    NODE_PATH="${NEW_NODE_PATH}" PATH="${NEW_PATH}" SUMAN_EXTRANEOUS_EXECUTABLE=yes \
        node "${X}/dist/cli.js" "${args[@]}"
        
else

    # we are probably in the global install space, so let's find the local installation given pwd/cwd
    LOCAL_SUMAN="$(node ${X}/scripts/find-local-suman-executable.js)"

    if [[ -z "$LOCAL_SUMAN" ]]; then
        # no local version found, so we fallback on the version in this directory, global or not
        echo " => No local Suman executable could be found, given the current directory => $PWD"
        echo " => Attempting to run installed version of Suman here => '${X}/cli.js'"
        NODE_PATH="${NEW_NODE_PATH}" PATH="${NEW_PATH}" SUMAN_EXTRANEOUS_EXECUTABLE="yes" \
            node "${X}/dist/cli.js" "${args[@]}"

    else
        # local version found, so we run it
        NODE_PATH="${NEW_NODE_PATH}" PATH="${NEW_PATH}" SUMAN_EXTRANEOUS_EXECUTABLE="yes" \
            node "${LOCAL_SUMAN}" "${args[@]}"
    fi

fi
