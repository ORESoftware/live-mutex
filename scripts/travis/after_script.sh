#!/usr/bin/env bash

if ! which coveralls; then
    npm i -f -g 'coveralls@3.0.3'
fi

cat coverage/lcov.info | coveralls