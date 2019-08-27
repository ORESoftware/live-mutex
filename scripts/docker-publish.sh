#!/usr/bin/env bash


set -e;

cd `dirname $(dirname "$BASH_SOURCE")`

version=`read_json -k 'version' -f package.json`;
semver "$version"; # validate semver version

tsc

version_tag="oresoftware/live-mutex-broker:$version";
latest_tag='oresoftware/live-mutex-broker:latest'

docker build -t  "$version_tag" .


docker tag  "$latest_tag" "$version_tag"

docker push "$version_tag"
docker push "$latest_tag"




