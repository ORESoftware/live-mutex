#!/usr/bin/env bash

str=`cat package.json`;
my_val="$(node -pe "JSON.parse(\`$str\`)['version']")"

#my_val=`node -pe JSON.parse()['version']`

#my_val="$(node -pe JSON.parse("$str")[version])"

echo "$my_val"