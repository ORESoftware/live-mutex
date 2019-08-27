#!/usr/bin/env bash


set -e;

cd `dirname $(dirname "$BASH_SOURCE")`

version=`read_json -k 'version' -f package.json`;
semver "$version"; # validate semver version

version=4

tsc


version_tag="oresoftware/live-mutex-broker:$version";
latest_tag='oresoftware/live-mutex-broker:latest'

docker build -t  "$version_tag" .


exit 0;

docker tag  "$latest_tag" "$version_tag"

docker push "$version_tag"
docker push "$latest_tag"




