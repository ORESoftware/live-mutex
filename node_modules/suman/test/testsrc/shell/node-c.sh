#!/bin/bash

DIR=$(dirname "$0");
echo "DIR => $DIR"
RESULT="";
VAL=""

while [ "$DIR" != "/" ] ;
do DIR=$(dirname $(dirname "$DIR"));
RESULT=$(find "$DIR" -maxdepth 1 -name package.json);
if [ ! -z "$RESULT" ]; then break; fi;
 done


IFS=$'\n' # set this so that find command works for files with spaces in the path
echo "DIR WITH package.json is => $DIR"

find $(dirname "$DIR") -maxdepth 8 -type f  -path "*.js" -not -path "*/node_modules/*" \
-not -path "*/node_modules/*" -not -path "*/babel/*" -not -path "*/examples/*" | while read line; do
# try to compile all .js files
(node -c ${line} && echo " processed file $line") || ( echo "file could not be compiled => $line")
done



EXIT_CODE="$?"
echo " exit code => $EXIT_CODE"
exit "$EXIT_CODE"

#echo "oh yes "$NODE_CHANNEL_FD"" >&2
#
#if [ ! -z "$NODE_CHANNEL_FD" ]; then
#printf "{\"type\":\"CONSOLE_LOG\",\"data\":\"weakkkkknesss\"}\n" 1>& ${NODE_CHANNEL_FD}
# printf "{\"type\":\"CONSOLE_LOG\",\"data\":\"weakkkkknesss\"}\n" 1>& ${NODE_CHANNEL_FD}
#fi

#sleep 2
#MESSAGE=$(read -u "$NODE_CHANNEL_FD" msg)
#echo " parent message => $msg"  >&2

#MESSAGE=$(read -u "$NODE_CHANNEL_FD")
#echo " parent message => $MESSAGE"  >&2
#
#MESSAGE=$(read -u "$NODE_CHANNEL_FD")
#echo " parent message => $MESSAGE"  >&2

#node $(dirname $(dirname "$0"))/es5-es6/a.js

