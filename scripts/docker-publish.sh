#!/usr/bin/env bash


set -e;

version=`read_json -k 'version' -f package.json`;
semver "$version"; # validate semver version

docker build -t "oresoftware/live-mutex-broker:$version" .

docker push "oresoftware/live-mutex-broker:$version"