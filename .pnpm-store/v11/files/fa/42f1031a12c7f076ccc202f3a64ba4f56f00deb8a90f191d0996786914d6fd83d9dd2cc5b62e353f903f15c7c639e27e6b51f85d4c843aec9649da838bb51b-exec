#!/usr/bin/env bash

# NOTE TO READER - if you wish to modify this file please move it outside the ~/.suman dir, because suman
# may periodically update this file's contents which would overwrite your changes
# if you do so, just change your .bashrc or .zshrc, or whatever, to source your file instead of this one

# we use this to cache this value in subshells
# we should not cache, because switching between nvm versions

# do not use `set -e;` since this will cause user's terminals to close
# if they source this file

export suman_global_npm_modules_path="$(npm root -g)";


handle_global_suman() {

    WHICH_SUMAN=$(which suman);
#    GLOBAL_MODULES="$(npm root -g)";
#    NEW_NODE_PATH="${NODE_PATH}":"$HOME/.suman/global/node_modules":"${GLOBAL_MODULES}"

    NEW_NODE_PATH="${NODE_PATH}":"$HOME/.suman/global/node_modules"
    NEW_PATH="${PATH}":"$HOME/.suman/global/node_modules/.bin";

    if [ -z "${WHICH_SUMAN}" ]; then
        echo "[suman] => No global suman installation could be found with '\$ which suman', exiting..."
        return 1;
    else

        DIRN="$(dirname "$WHICH_SUMAN")";
        RL="$(readlink "$WHICH_SUMAN")";
        EXECDIR="$(dirname $(dirname "$RL"))";
        MYPATH="$DIRN/$EXECDIR";
        X="$(cd $(dirname ${MYPATH}) && pwd)/$(basename ${MYPATH})"

        # $1 is the node exec args (inspect/debug etc), $2 is the original user args
        # we work with the first argument passed to this function
        local ref1="$1[@]";
        shift
        NODE_PATH="${NEW_NODE_PATH}" PATH="${NEW_PATH}"  node "${!ref1}" "${X}/dist/cli.js" "$@";
    fi
}


suman(){

    if test ${#} -eq 0; then

        echo "[suman] using suman-shell instead of suman executable.";
        suman-shell "$@"; # note we should have no arguments so passing "$@" to suman-shell should be pointless

    else

        suman_inspect="no";

        for item in $@; do
            if [[ "--inspect" == "$item" || "--inspect-brk" == "$item" ]]; then
                suman_inspect="yes";
            fi
        done

        if [[ "${suman_inspect}" == "yes" ]]; then
            "$(dirname "$0")/suman-inspect" "$@";
            exit $?;
        fi

        echo "[suman] => Using 'suman' alias in suman-clis.sh...";
        LOCAL_SUMAN="$(node "$HOME/.suman/find-local-suman-executable.js")";
        NEW_NODE_PATH="${NODE_PATH}":"$HOME/.suman/global/node_modules";
        NEW_PATH="${PATH}":"$HOME/.suman/global/node_modules/.bin";

        if [[ "${SUMAN_FORCE_GLOBAL}" == "yes" || -z "$LOCAL_SUMAN" ]]; then

            echo "[suman] => No local Suman executable could be found, given the present working directory => $PWD";
            echo "[suman] => Warning...attempting to run a globally installed version of Suman...";
            local -a node_exec_args=( );
            handle_global_suman node_exec_args "$@";

        else
            NODE_PATH="${NEW_NODE_PATH}" PATH="${NEW_PATH}" node "$LOCAL_SUMAN" "$@";
        fi
    fi
}


 suman-shell() {

    echo "[suman] => Using 'suman' alias in suman-clis.sh..."

    if [[ "${SUMAN_WATCH_TEST_RUN}" == "yes" ]]; then
        echo "[suman] Cannot run suman-shell from a watch process.";
        echo "[suman] Cannot run suman-shell from a watch process." >&2 ;
        exit 1;
    fi

    LOCAL_SUMAN="$(node "$HOME/.suman/find-local-suman-executable.js")";
    NEW_NODE_PATH="${NODE_PATH}":"$HOME/.suman/global/node_modules"
    NEW_PATH="${PATH}":"$HOME/.suman/global/node_modules/.bin";

    local -a args=("$@")
    args+=("--suman-shell")

    if [[ "${SUMAN_FORCE_GLOBAL}" == "yes" || -z "$LOCAL_SUMAN" ]]; then
        echo "[suman] => No local Suman executable could be found, given the present working directory => $PWD"
        echo "[suman] => Warning...attempting to run a globally installed version of Suman..."
        local -a node_exec_args=( )
        handle_global_suman node_exec_args "${args[@]}"
    else
        NODE_PATH="${NEW_NODE_PATH}" PATH="${NEW_PATH}" node "$LOCAL_SUMAN" "${args[@]}";
    fi
}


suman-inspect() {

    echo "[suman] => Using 'suman-inspect' alias in suman-clis.sh...";
    LOCAL_SUMAN="$(node "$HOME/.suman/find-local-suman-executable.js")";
    NEW_NODE_PATH="${NODE_PATH}":"$HOME/.suman/global/node_modules";
    NEW_PATH="${PATH}":"$HOME/.suman/global/node_modules/.bin";

    if [[ "${SUMAN_FORCE_GLOBAL}" == "yes" || -z "$LOCAL_SUMAN" ]]; then
        echo "[suman] => No local Suman executable could be found, given the present working directory => $PWD"
        echo "[suman] You can use '$ which suman-debug' to find a globally installed version."
        echo "[suman] => Warning...attempting to run a globally installed version of Suman..."
        local -a node_exec_args=( --inspect --debug-brk )
        handle_global_suman node_exec_args "$@"
    else
        echo "[suman] running node against local suman"
        NODE_PATH="${NEW_NODE_PATH}" PATH="${NEW_PATH}" node --inspect --debug-brk "$LOCAL_SUMAN" "$@";
    fi
}

 suman-debug() {

    echo "[suman] => Using 'suman-debug' alias in suman-clis.sh..."
    LOCAL_SUMAN="$(node "$HOME/.suman/find-local-suman-executable.js")";
    NEW_NODE_PATH="${NODE_PATH}":"$HOME/.suman/global/node_modules";
    NEW_PATH="${PATH}":"$HOME/.suman/global/node_modules/.bin";

    if [[ "${SUMAN_FORCE_GLOBAL}" == "yes" || -z "$LOCAL_SUMAN" ]]; then
        echo "[suman] No local Suman executable could be found, given the current directory => $PWD"
        echo "[suman] You can use '$ which suman-debug' to find a globally installed version."
        echo "[suman] => Warning...attempting to run a globally installed version of Suman..."
        local -a node_exec_args=( debug )
        handle_global_suman node_exec_args "$@"
    else
        NODE_PATH="${NEW_NODE_PATH}" PATH="${NEW_PATH}" node debug "$LOCAL_SUMAN" "$@";
    fi
}

 suman--debug() {

    echo "[suman] => Using 'suman--debug' alias in suman-clis.sh..."
    LOCAL_SUMAN="$(node "$HOME/.suman/find-local-suman-executable.js")";
    NEW_NODE_PATH="${NODE_PATH}":"$HOME/.suman/global/node_modules";
    NEW_PATH="${PATH}":"$HOME/.suman/global/node_modules/.bin";

    if [[ "${SUMAN_FORCE_GLOBAL}" == "yes" || -z "$LOCAL_SUMAN" ]]; then
        echo "[suman] No local Suman executable could be found, given the current directory => $PWD"
        echo "[suman] Use '$ which suman--debug' to find a globally installed version."
        echo "[suman] => Warning...attempting to run a globally installed version of Suman..."
        local -a node_exec_args=( --debug-brk=5858 --debug=5858 )
        handle_global_suman node_exec_args "$@"
    else
        NODE_PATH="${NEW_NODE_PATH}" PATH="${NEW_PATH}" node --debug-brk=5858 --debug=5858 "$LOCAL_SUMAN" "$@";
    fi
}


export -f suman;
export -f suman-debug;
export -f suman--debug;
export -f suman-inspect;
export -f suman-shell;
export -f handle_global_suman;
