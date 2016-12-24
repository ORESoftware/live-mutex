#!/usr/bin/env bash

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "dev" ]]; then
  echo 'Aborting script because you are not on the right git branch (dev).';
  exit 1;
fi

git add .
git add -A
git commit -am "Temp commit before publish to gh-pages"
git remote add publish git@github.com:ORESoftware/suman.git
git checkout -b gh-pages
git subtree push --prefix public/jsdoc-out publish gh-pages
git checkout dev
git branch -d gh-pages
git remote rm publish