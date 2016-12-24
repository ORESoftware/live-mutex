#!/usr/bin/env bash

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "dev" ]]; then
    echo 'Aborting script because you are not on the right git branch (dev).';
    exit 1;
fi

# CM => commit message, default is "set"
CM=${1:-set}

git add . &&
git add -A &&
git commit --allow-empty -am "pdev:$CM" &&

if [[ "$1" = "push" ]]; then
git push
fi
