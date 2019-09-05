#!/usr/bin/env bash


set -e;

cd `dirname $(dirname "$BASH_SOURCE")`

version=`read_json -k 'version' -f package.json`;
semver "$version"; # validate semver version


tsc

version_tag="oresoftware/live-mutex-broker:$version";

docker build -t "$version_tag" .

echo "$version_tag"

exit 0;

docker push "$version_tag"





