#!/usr/bin/env bash
#echo ${FILE_TO_TAIL}
open -n -g com.apple.terminal `dirname $0`/tail.sh
#open -b com.apple.terminal -e "tail -F ${FILE_TO_TAIL}"