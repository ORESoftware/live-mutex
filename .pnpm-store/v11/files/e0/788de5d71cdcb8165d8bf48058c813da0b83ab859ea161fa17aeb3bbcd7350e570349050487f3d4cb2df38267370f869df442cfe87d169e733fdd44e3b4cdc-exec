#!/usr/bin/env bash

# docker run -it your-dockerized-suman-tests-image /bin/bash

echo "args1 => $1"
echo "args2 => $2"

echo "pwd => $(pwd)"
project_root="$(cd $(npm root) && cd .. && pwd)";

project_basename="$(basename ${project_root})";

image_tag="your-dockerized-suman-tests-image";
container_name="your-dockerized-suman-tests"

dockerfile_root="${project_root}/$(uuidgen)"
cp "$(cd $(dirname "$0") && pwd)/Dockerfile" "${dockerfile_root}"

function cleanup {
  # in case the user kills script prematurely
  rm -rf "${dockerfile_root}";
}

trap cleanup EXIT

#
#docker rmi -f $(docker images --no-trunc | grep "<none>" | awk "{print \$3}")
#docker rmi -f $(docker images --no-trunc | grep "${image_tag}" | awk "{print \$3}")
#docker rmi -f ${image_tag}
#

docker stop "${container_name}" > /dev/null 2>&1
docker rm "${container_name}" > /dev/null 2>&1

echo "building the test with docker build...";
docker build -t ${image_tag} -f ${dockerfile_root} ${project_root} #  > /dev/null

rm -rf ${dockerfile_root};

echo "arguments to suman executable: '$1'"
echo "running the test with docker run...";

#docker run -v "${project_root}/node_modules":/usr/src/app --name  ${container_name} ${image_tag}

#docker run -v ${project_root}/node_modules:/home/docker/app/node_modules \
# --name="${container_name}" "${image_tag}" --entrypoint=/bin/bash $@

docker run -v ${project_root}/node_modules:/home/docker/app/node_modules:ro \
 --name "${container_name}" "${image_tag}" node test/e2e/by-roles/admin/admin-page/first.test.js

