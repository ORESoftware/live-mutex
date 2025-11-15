#!/usr/bin/env sh

cmd="$1";
shift 1;

if [ "$cmd" = "start" ]; then

  lmx_start_server "$@"

elif [ "$cmd" = "launch" ]; then

  lmx_start_server "$@"


elif [ "$cmd" = "acquire" ]; then

  lmx_acquire_lock "$@"


elif [ "$cmd" = "release" ]; then

  lmx_release_lock "$@"


elif [ "$cmd" = "inspect" ]; then

  lmx_inspect_broker "$@"


elif [ "$cmd" = "ls" ]; then

  lmx_ls "$@"

elif [ "$cmd" = "status" ]; then

  lmx-status "$@"

elif [ "$cmd" = "test" ]; then

  lmx-test "$@"

elif [ "$cmd" = "quick-start" ]; then

  lmx-quick-start "$@"

else

  echo "lmx: no subcommand was recognized. Possible subcommands: acquire, release, inspect, launch, start, status, test, quick-start"
  exit 1;

fi
