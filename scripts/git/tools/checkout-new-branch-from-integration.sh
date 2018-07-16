#!/usr/bin/env bash

set -e;

branch_type="${1:-feature}";
arr=( 'feature' 'bugfix' 'release' );

contains() {

    local seeking="$1"
    shift 1;
    local arr=( "$@" )

    for v in "${arr[@]}"; do
        if [ "$v" == "$seeking" ]; then
            return 0;
        fi
    done
   return 1;
}

if ! contains "$branch_type" "${arr[@]}"; then
    echo "Branch type needs to be either 'feature', 'bugfix' or 'release'."
    echo "The branch type you passed was: $branch_type"
    exit 1;
fi


git fetch origin dev;

time_seconds=`node -e 'console.log(String(Date.now()).slice(0,-3))'`;

echo "You are checking out a new $branch_type branch from the dev branch"
new_branch="${USER}/${branch_type}/${time_seconds}"

echo "New branch name: $new_branch";

git checkout -b "${new_branch}" "origin/dev"
git push -u origin HEAD  # makes sure git is tracking this branch on the primary remote
