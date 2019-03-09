#!/usr/bin/env bash


tsc
docker build -t lmx_broker .
docker stop lmx_broker | cat
docker rm lmx_broker | cat
docker run -it -p 6970:6970 --name lmx_broker lmx_broker