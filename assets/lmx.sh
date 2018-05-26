#!/usr/bin/env bash


cmd="$1";
shift 1;

if [ "$cmd" == "start" ]; then

  lm_start_server "$@"
  exit $?

elif [ "$cmd" == "acquire" ]; then

  lm_acquire_lock "$@"
  exit $?

elif [ "$cmd" == "release" ]; then

  lm_release_lock "$@"
   exit $?

elif [ "$cmd" == "inspect" ]; then

  lm_inspect_broker "$@"
   exit $?

elif [ "$cmd" == "ls" ]; then

  lm_ls "$@"
   exit $?

else

  echo "no subcommand was recognized."
  exit 1;

fi
