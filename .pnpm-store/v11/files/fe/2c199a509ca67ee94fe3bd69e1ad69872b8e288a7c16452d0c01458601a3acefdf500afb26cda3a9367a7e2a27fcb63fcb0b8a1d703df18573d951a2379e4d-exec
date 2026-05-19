#!/usr/bin/env bash

which_wds=$(which webpack-dev-server);

if [[ -z ${which_wds} ]]; then
    npm install webpack-dev-server -g
fi

webpack-dev-server
