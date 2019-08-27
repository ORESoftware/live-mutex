#!/usr/bin/env bash

set -e;

cd  "$(dirname "${BASH_SOURCE[0]}")";

echo "pwd: $(pwd)"

my_sock="$(pwd)/fixtures/uds.sock";

rm -f "$my_sock"

chmod -R 777 "$(pwd)/fixtures"

docker run -d -v "$(pwd)/fixtures":/uds 'oresoftware/live-mutex-broker:4' --use-uds

sleep 2;

node 'simple-uds-client.js'