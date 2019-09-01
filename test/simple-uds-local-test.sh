#!/usr/bin/env bash

set -e;

cd "$(dirname "$(dirname "${BASH_SOURCE[0]}")")";

echo "pwd: $(pwd)"

#my_sock="$(pwd)/fixtures/uds.sock";

my_sock="$HOME/.lmx/uds.sock"

mkdir -p "$HOME/.lmx";

rm -f "$my_sock"

#docker run -d -v "$(pwd)/fixtures":/uds 'oresoftware/live-mutex-broker:4' --use-uds

(node dist/lm-start-server.js --use-uds) &

sleep 2;

node 'test/simple-uds-local-client.js'