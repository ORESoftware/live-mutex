#!/usr/bin/env bash

set -e;

if [[ "${SUMAN_ENV}" != "local" ]]; then
 echo " => SUMAN_ENV env variable is not set to 'local' so we will run suman instead of suman-f.";
 "$(cd $(dirname "$0") && pwd)/suman" "$@";
  exit $?;
fi

mkdir -p "${HOME}/.suman/global"
mkdir -p "${HOME}/.suman/logs"

trap 'echo ""; echo " (note that your test ran with suman-f, not suman)   "; echo "";' INT

BASH_PID="$$"
ARGS=""; for i; do ARGS=$(printf '%s"%s"' "$ARGS", "$i"); done;
ARGS=${ARGS#,}


# http://xmodulo.com/tcp-udp-socket-bash-shell.html
exec 3<>/dev/tcp/localhost/9091  # persistent file descriptor

# to disconnect, use `exec 3>&-`  # https://unix.stackexchange.com/questions/131801/closing-a-file-descriptor-vs

EXIT_CODE_VAL=$?

if [[ ${EXIT_CODE_VAL} -ne 0 ]]; then
  echo "" # print blank line
  echo " => could not connect to suman-daemon - perhaps suman-daemon is not running.";
  echo " => use '$ suman-daemon' to start the daemon as a background process, and you can put this command in .bashrc.";
  echo ""; # print blank line
  exit 1;
fi

echo "{\"pid\":${BASH_PID},\"args\":[${ARGS}],\"cwd\":\"$(pwd)\"}"  >&3
cat <&3

