#!/usr/bin/env bash

set -e;

if [[ ! -f "webpack.config.js" ]]; then
   echo "cannot find webpack.config.js file in pwd => $(pwd)";
   exit 1;
fi

echo "wtf"

(
    cd "$HOME/WebstormProjects/oresoftware"

    [ ! -d "node_modules/babel-runtime" ] && npm install babel-runtime
    [ ! -d "node_modules/babel-core" ] && npm install babel-core
    [ ! -d "node_modules/babel-plugin-transform-runtime" ] && npm install babel-plugin-transform-runtime
    [ ! -d "node_modules/babel-plugin-transform-runtime" ] && npm install babel-plugin-transform-runtime
    [ ! -d "node_modules/babel-preset-es2015" ] && npm install babel-preset-es2015
    [ ! -d "node_modules/babel-preset-es2016" ] && npm install babel-preset-es2016
    [ ! -d "node_modules/babel-polyfill" ] && npm install babel-polyfill
    [ ! -d "node_modules/babel-preset-stage-0" ] && npm install babel-preset-stage-0
    [ ! -d "node_modules/babel-preset-stage-1" ] && npm install babel-preset-stage-1
    [ ! -d "node_modules/babel-preset-stage-2" ] && npm install babel-preset-stage-2
    [ ! -d "node_modules/babel-preset-stage-3" ] &&  npm install babel-preset-stage-3
    [ ! -d "node_modules/babel-preset-latest" ] &&  npm install babel-preset-latest
    [ ! -d "node_modules/babel-preset-env" ] &&  npm install babel-preset-env
)



NODE_PATH="${NODE_PATH}":"$HOME/.suman/global/node_modules" webpack
