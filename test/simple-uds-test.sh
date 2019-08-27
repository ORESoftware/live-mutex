#!/usr/bin/env bash

set -e;

cd  "$(dirname "${BASH_SOURCE[0]}")";

echo "pwd: $(pwd)"

my_sock="$(pwd)/fixtures/uds.sock";

chmod -R 777 "$(pwd)/fixtures"
rm -f "$my_sock"

docker run -d -v "$(pwd)/fixtures":/uds 'oresoftware/live-mutex-broker:4' --use-uds

sleep 4;

node 'simple-uds-client.js'