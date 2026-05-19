#!/usr/bin/env bash

#set -e;

if [[ -n "${LOCAL_SUMAN_ALREADY_FOUND+x}" ]]; then
    echo " => \$LOCAL_SUMAN_ALREADY_FOUND ? => $LOCAL_SUMAN_ALREADY_FOUND"
fi

#. shared-functions.sh # source this shared file

if test "$#" -eq "0"; then
    # if there are no arguments to `$suman` then we launch `$suman-shell` instead
#    exec "$(dirname "$0")/suman-shell"
    "$(dirname "$0")/suman-shell"
    exit $?;
fi

suman_inspect="no"

for item in $@; do
    if [[ "--inspect" == "$item" || "--inspect-brk" == "$item" ]]; then
        suman_inspect="yes"
    fi
done

if test "$suman_inspect" == "yes"; then
    echo "running suman inspect.";
#    "$(dirname "$0")/suman-inspect" "$@"
    exit $?;
fi


echo " [suman] Original path of Suman executable => \"$0\""
dir_name="$(dirname "$0")"
read_link="$(readlink "$0")";
exec_dir="$(dirname $(dirname "$read_link"))";
my_path="$dir_name/$exec_dir";
suman_root="$(cd $(dirname ${my_path}) && pwd)/$(basename ${my_path})"
new_node_path="${NODE_PATH}":"$HOME/.suman/global/node_modules"
new_path="${PATH}":"$HOME/.suman/global/node_modules/.bin"

if [[ "${LOCAL_SUMAN_ALREADY_FOUND}" == "yes" ]]; then
    # we know that this directory contains the local version of suman we want to use
    echo " [suman] local suman version already found.";
    NODE_PATH="${new_node_path}" PATH="${new_path}" SUMAN_EXTRANEOUS_EXECUTABLE="yes" \
        node "${suman_root}/dist/cli.js" "$@"
else

    # we are probably in the global install space, so let's find the local installation given pwd/cwd

    project_root="$(node ${suman_root}/scripts/find-project-root.js)"

    if [[ -z "$project_root" ]]; then
       echo >&2 " [suman] Could not find your project root given your current working directory:";
       echo >&2 " [suman] Your pwd: '$PWD'";
       exit 1;
    fi

    local_suman="$(node ${suman_root}/scripts/find-local-suman-executable.js)"

    if [[ -z "$local_suman" ]]; then

       # symlink the global suman installation to the local project

       if true; then
           echo "major foo.";
           echo "Symlinking global suman installation to local project.";
           mkdir -p "${project_root}/node_modules/suman"
           rm -rf "${project_root}/node_modules/suman";
           ln -sf "$suman_root" "$project_root/node_modules/suman"
       fi

        # no local version found, so we fallback on the version in this directory, global or not

        echo " [suman] => No local Suman executable could be found, given the current directory => $PWD"
        echo " [suman] => Attempting to run installed version of Suman here => '${suman_root}/dist/cli.js'"

        GLOBAL_MODULES="${suman_global_npm_modules_path:-"$(npm root -g)"}"
        NODE_PATH="${new_node_path}":"${GLOBAL_MODULES}" PATH="${new_path}" SUMAN_EXTRANEOUS_EXECUTABLE="yes" \
            node "${suman_root}/dist/cli.js" "$@"

    else
        # local version found, so we run it
        NODE_PATH="${new_node_path}" PATH="${new_path}" SUMAN_EXTRANEOUS_EXECUTABLE="yes" \
            node "${local_suman}" "$@"
    fi

fi
