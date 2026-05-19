#!/usr/bin/env bash

#set -e;

if [[ "${SUMAN_ENV}" != "local" ]]; then
   echo ""; echo "suman-daemon will only run if \$SUMAN_ENV is set to 'local'."; echo "";
   exit 1;
fi

#set -e;

echo "[suman-daemon] checking if existing process is listening on port"
# which_false=$(which false); # /bin/false or /usr/bin/false depending on system


if [[ "$1" != "--force" ]]; then

    nc -zv localhost 9091  > /dev/null 2>&1
    nc_exit="$?"

    if [ "${nc_exit}" -eq "0" ]; then
        echo "a process is already listening on the default port"
        echo "please choose another port with --port=x"
        echo "suman-daemon may already be running - check with 'ps aux | grep suman-daemon'"
        echo "otherwise, use '$ suman-daemon --force'."
        exit 1;
    fi

else
    pkill -f suman-daemon  # kill any existing suman-daemon process
fi


# we use supervisor, so do not need to force kill
# we have to use the global version,
# because otherwise we would not know which suman installation to pre-load

mkdir -p "$HOME/.suman/global"
mkdir -p "$HOME/.suman/logs"

NPM_ROOT_GLOBAL="${suman_global_npm_modules_path:-"$(npm root -g)"}"
export NODE_PATH="${NODE_PATH}":"$HOME/.suman/global/node_modules":"${NPM_ROOT_GLOBAL}"
export PATH="${PATH}":"$HOME/.suman/global/node_modules/.bin":"${NPM_ROOT_GLOBAL}/suman-daemon/node_modules/.bin"
export SUMAN_LIBRARY_ROOT_PATH="${NPM_ROOT_GLOBAL}/suman";

#WHICH_FOREVER="$(which forever)";
#
#if [[ -z ${WHICH_FOREVER} ]]; then
# (cd "$HOME/.suman/global" && npm install forever)
#fi

if [[ -L "${NPM_ROOT_GLOBAL}/suman" || -d "${NPM_ROOT_GLOBAL}/suman" ]]; then
    echo "[suman-daemon] suman is already installed globally, that's great.";
else
    # we need to install suman globally so that suman-daemon always pre-loads the same version of suman
    echo "[suman-daemon] suman is not installed globally, we will install suman globally now.";
    npm install -g suman;
fi

daemon_log="$HOME/.suman/logs/suman-daemon.log";

echo "[suman-daemon] beginning of new daemon process" > ${daemon_log};

if [[ -L "${NPM_ROOT_GLOBAL}/suman-daemon" || -d "${NPM_ROOT_GLOBAL}/suman-daemon" ]]; then

    echo "[suman-daemon] found suman-daemon global installation."
    echo "[suman-daemon] now starting suman-daemon..."
    node "${NPM_ROOT_GLOBAL}/suman-daemon" > "${daemon_log}" 2>&1 # &
    # forever start "${NPM_ROOT_GLOBAL}/suman-daemon/index.js" --workingDir $(pwd)

else

   echo " [suman daemon] installing suman-daemon globally, use --force-local to enforce local installations.";
   npm install -g suman-daemon &&
   node "${NPM_ROOT_GLOBAL}/suman-daemon"  > "${daemon_log}" 2>&1  #&
   # forever start "${NPM_ROOT_GLOBAL}/suman-daemon/index.js" --workingDir $(pwd)

fi


