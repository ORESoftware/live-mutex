#!/usr/bin/env bash

# remove dirs
git rm -r --ignore-unmatch .idea public private bugs examples internal-docs \
jsdoc-out node_modules .DS_Store &&

# remove files
git rm --ignore-unmatch pdev.sh build.sh docker-notes.txt jsdoc.conf.json docker-notes.txt publish-gh-pages.sh pre-publish-gh-pages.sh \
publish-suman*.sh exp*.js jsdoc-notes.txt suman-todos.txt .DS_Store &&

# all done
echo "All done deleting files from project! LOL"
