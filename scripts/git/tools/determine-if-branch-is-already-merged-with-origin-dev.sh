#!/usr/bin/env bash


green='\033[1;32m'
red='\e[31m'
no_color='\033[0m'


branch="${1:-HEAD}"

branch_name=`git rev-parse --abbrev-ref $branch`;

git fetch origin dev;
git fetch origin master;


merge_base="$(git merge-base $branch origin/dev)"
merge_source_current_commit="$(git rev-parse $branch)"


if [ "$merge_base" != "$merge_source_current_commit" ]; then
    echo -e "${red}Branch with name '$branch_name' is not completely merged with origin/dev.${no_color}";
    exit 1;
else
    echo -e "${green}Branch with name '$branch_name' is merged with origin/dev, now checking against origin/master${no_color}";
fi

merge_base="$(git merge-base $branch origin/master)"

if [ "$merge_base" != "$merge_source_current_commit" ]; then
    echo -e "${red}Branch with name '$branch_name' is not completely merged with orign/master.${no_color}";
    exit 1;
fi


echo -e "${green}branch with name '$branch_name' is completely merged with origin/dev and origin/master.${no_color}"

echo "To delete this branch run: git branch -d '$branch_name'"