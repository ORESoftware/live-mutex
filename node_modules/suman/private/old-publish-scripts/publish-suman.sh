#!/usr/bin/env bash

# GIT_COMMIT_MSG = $1 # first argument to script

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "dev" ]]; then
  echo 'Aborting script because you are not on the right git branch (dev).';
  exit 1;
fi

### start of the end ###
git remote add public git@github.com:ORESoftware/suman.git  # https://github.com/ORESoftware/suman.git might already exist which is bad but OK
git fetch public &&
git add . &&
git add -A &&
git commit --allow-empty -am "publish/release:$1" &&
git push &&
git checkout -b devtemp &&
./delete-internal-paths.sh &&
git add . &&
git add -A &&
git commit -am "publish/release:$1" &&
git checkout -b temp public/master &&
# we make sure we can merge automatically before patching version
git merge -Xtheirs --squash -m "squashed with devtemp" devtemp &&
git checkout dev -f &&
git branch -D temp devtemp &&


npm version patch --force -m "Upgrade for several reasons" && # bump version
git add . &&
git add -A &&
git commit --allow-empty -am "publish/release:$1" &&
git push &&
git checkout -b devtemp &&
./delete-internal-paths.sh &&
git add . &&
git add -A &&
git commit -am "publish/release:$1" &&
git checkout -b temp public/master &&
git merge -Xtheirs --squash -m "squashed with devtemp" devtemp &&
git rm delete-internal-paths.sh -f &&
git add . &&
git add -A &&
git commit -am "publish/release:$1" &&
git push public temp:master &&
git remote rm public &&
git checkout dev &&
git branch -D devtemp &&
git branch -D temp &&
npm publish .


