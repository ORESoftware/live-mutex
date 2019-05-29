#!/usr/bin/env bash


set -e;

cd `dirname $(dirname "$BASH_SOURCE")`

version=`read_json -k 'version' -f package.json`;
semver "$version"; # validate semver version

tsc

docker build -t "oresoftware/live-mutex-broker:$version" .

docker push "oresoftware/live-mutex-broker:$version"


