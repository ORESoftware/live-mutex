#!/usr/bin/env bash


set -e;

cd `dirname $(dirname "$BASH_SOURCE")`

version=`read_json -k 'version' -f package.json`;
semver "$version"; # validate semver version

tsc

node_versions=( 8 9 10 11 12 )

for v in "${node_versions[@]}"; do

    echo "v => $v"
    docker build -t "oresoftware/lmx-circleci:$v" -f Dockerfile.circleci --build-arg base="circleci/node:$v" .
    docker push "oresoftware/lmx-circleci:$v"

done



