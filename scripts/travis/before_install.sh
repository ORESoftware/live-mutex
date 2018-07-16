#!/usr/bin/env bash

if ! which tsc >/dev/null ; then
    npm install -g typescript
fi


tsc || echo "whatever"