#!/usr/bin/env bash

# usage:
# GIT_COMMIT_MSG = $1  =>  first argument to script
# if second argument to script $2 is "publish"  then we publish to NPM

echo "not being used anymore"
exit 1;

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

MILLIS_SINCE_EPOCH=$(date +%s%N | cut -b1-13)
GIT_COMMIT_MSG=${1:-"${MILLIS_SINCE_EPOCH}"} &&

git add . &&
git add -A &&
git commit --allow-empty -am "pre:$GIT_COMMIT_MSG" &&
git pull &&
git add . &&
git add -A &&
git commit --allow-empty -am "publish/release:$GIT_COMMIT_MSG" &&
git push &&                     # push to private/dev remote repo
git branch -D dev_squash_temp && # fuck that branch
git checkout -b dev_squash_temp dev_squash &&
git merge --squash -X theirs dev -m "squashing" &&  # make sure the merge succeeds before actually doing it...
(./test/testsrc/shell/node-c.sh && echo "compiled successfully") || (git reset --hard; exit 1) &&
git checkout dev_squash -f &&    # we do squashing on this branch
git branch -D dev_squash_temp &&
git merge --squash -X theirs dev -m "squashing" &&
(./test/testsrc/shell/node-c.sh && echo "compiled successfully") || (git reset --hard; exit 1) &&
git add . &&
git add -A &&
git commit --allow-empty -am "publish/release:$GIT_COMMIT_MSG" &&
git checkout -b temp  &&                                          # we checkout this branch to run deletes on private files
./delete-internal-paths.sh &&
git rm delete-internal-paths.sh -f &&
git add . &&
git add -A &&
git commit --allow-empty -am "publish/release:$GIT_COMMIT_MSG" &&
#git rebase $(git describe --tags) &&
(./test/testsrc/shell/node-c.sh && echo "compiled successfully") || (git reset --hard; exit 1) &&
#git merge -Xours --squash origin/staging &&
git push origin HEAD:staging -f &&

if [ "$2" = "publish" ]; then
   npm publish .  &&    # bump version
   echo "published suman to NPM"
fi

git checkout dev &&
git branch -D temp



