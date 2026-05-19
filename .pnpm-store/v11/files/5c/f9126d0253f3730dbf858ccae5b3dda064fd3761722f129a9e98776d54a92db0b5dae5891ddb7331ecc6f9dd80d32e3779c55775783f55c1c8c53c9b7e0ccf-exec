#!/usr/bin/env bash

echo "we are running @run.sh => suman-run-plugins/plugins/typescript-std => $0"

which_istanbul=$(which istanbul);

if [[ -z "${which_istanbul}" ]]; then

   if [[ -L "./node_modules/bin/istanbul" ]]; then
        which_istanbul="$(readlink "./node_modules/bin/istanbul")";
   else
        npm install -g istanbul;
        which_istanbul="istanbul";
   fi

fi


exec "${which_istanbul}"

EXIT_CODE=$?;
echo "EXIT_CODE => $EXIT_CODE"
exit ${EXIT_CODE};

