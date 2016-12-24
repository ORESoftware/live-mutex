#!/usr/bin/env bash


MYPATH=/Users/Olegzandr/.nvm/versions/node/v7.2.0/bin/../lib/node_modules/suman/cli/cli.sh;
echo $PWD
RESOLVED="$(cd $(dirname "$MYPATH") && pwd)/$(basename "$MYPATH")"

echo $PWD

echo "RESOLVED $RESOLVED"
