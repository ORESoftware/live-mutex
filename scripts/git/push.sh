#!/usr/bin/env bash

# CM => commit message, default is "set"
CM=${1:-set}

git add . &&
git add -A &&
git commit --allow-empty -am "pdev:$CM" &&
git push &&
echo "pushed successfully to remote"