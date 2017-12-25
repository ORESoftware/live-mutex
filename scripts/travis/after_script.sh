#!/usr/bin/env bash


which_coveralls="$(which coveralls)"

if [[ -z "$which_coveralls" ]]; then
    npm install -g coveralls
fi


cat coverage/lcov.info | coveralls