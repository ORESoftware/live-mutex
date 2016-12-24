#!/usr/bin/env bash


jsdoc examples -u examples -d jsdoc-out
mv jsdoc-out/ public/
mr-doc -s examples/bdd-api -o mr-docs -n "BDD interface"
mr-doc -s examples/tdd-api -o mr-docs -n "TDD interface"
mv mr-docs public/jsdoc-out
cp -r public/images public/jsdoc-out
cp public/extra-html/* public/jsdoc-out/
