#!/usr/bin/env bash


set -e;

cd `dirname $(dirname "$BASH_SOURCE")`

version=`read_json -k 'version' -f package.json`;
semver "$version"; # validate semver version


version_without_patch="$(node scripts/echo-semver-without-patch.js "$version")"

if [[ -z "$version_without_patch" ]]; then
    echo 'Version without patch is empty.';
fi


tsc

version_tag="oresoftware/live-mutex-broker:$version_without_patch";
latest_tag='oresoftware/live-mutex-broker:latest'

docker build -t  "$version_tag" .


docker tag  "$latest_tag" "$version_tag"

docker push "$version_tag"
docker push "$latest_tag"




