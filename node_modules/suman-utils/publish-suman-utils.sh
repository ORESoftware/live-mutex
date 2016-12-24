#!/usr/bin/env bash

GIT_COMMIT_MSG=$1 # first argument to script

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "dev" ]]; then
  echo 'Aborting script because you are not on the right git branch (dev).';
  exit 1;
fi


if [ "$2" = "publish" ]; then
   npm version patch --force -m "Upgrade for several reasons" &&    # bump version
   echo "bumped version"
else
  echo "note that we are *not* publishing to NPM"
fi


git add . &&
git add -A &&
git commit --allow-empty -am "pre:${GIT_COMMIT_MSG}" &&
git pull &&
git add . &&
git add -A &&
git commit --allow-empty -am "publish/release:${GIT_COMMIT_MSG}" &&
git push &&
git checkout -b temp &&
# remove private directories
git rm -r --ignore-unmatch private &&
# remove private files
git rm --ignore-unmatch exp*.js &&
git add . &&
git add -A &&
git commit --allow-empty -am "publish/release:${GIT_COMMIT_MSG}" &&
git push origin HEAD:master -f &&

if [ "$2" = "publish" ]; then
   npm publish . &&
   echo "published to NPM successfully"
else
  echo "note that we are *not* publishing to NPM"
fi

git checkout dev &&
git branch -D temp

