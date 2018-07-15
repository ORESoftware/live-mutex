#!/usr/bin/env bash

set -e; # exit immediately if any command fails

current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [ "$current_branch" == "master" ] || [ "$current_branch" == "dev" ]; then
    echo 'Aborting script because you are on master or dev branch, you need to be on a feature branch.';
    exit 1;
fi

time_seconds=`node -e 'console.log(String(Date.now()).slice(0,-3))'`;
git fetch origin

git add .
git add -A
git commit --allow-empty -am "merge_at:${time_seconds}"


git merge -Xignore-space-change "origin/dev" # use --no-ff to force a new commit
git push origin HEAD

git checkout dev; # so we don't keep working on the old feature branch
git merge -Xignore-space-change origin/dev;
