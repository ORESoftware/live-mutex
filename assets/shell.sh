#!/usr/bin/env bash


all_export="yep";

if [[ ! "$SHELLOPTS" =~ "allexport" ]]; then
    all_export="nope";
    set -a;
fi


lmx_get_latest(){
  . "$BASH_SOURCE";
}


lmx(){

   local first_arg="$1";

   if [ "$first_arg" == "set" ]; then

      local second_arg="$2";
      local third_arg="$3";

     if [ -z "$second_arg" ]; then
        echo >&2 "lmx set a b, requires that a be defined/non-empty."
        return 1
     fi

     if [ -z "$third_arg" ]; then
        third_arg="";
        echo >&2 "warning, wrt: 'lmx set a b', b will be an empty variable, according to your most recent command."
     fi

      # declare "magic_variable_$1=$(ls | tail -1)"
      export "lmx_setting_$second_arg"="$third_arg";
      return 0;
   fi


    if [ "$first_arg" == "get" ]; then

      local second_arg="$2";

      if [ -z "$second_arg" ]; then
        echo >&2 "'\$ lmx get foo', requires that 'foo' be defined/non-empty."
        return 1
      fi

      local z="lmx_setting_$second_arg";
      echo "${!z}"  # "this is called "indirection", see: Evaluating indirect/reference variables"
      return 0;
   fi


   if ! type -f lmx &> /dev/null || ! which lmx &> /dev/null; then

      npm i -s -g 'live-mutex' || {
         echo >&2 "Could not install live-mutex globally; check your permissions to install NPM packages globally."
         return 1;
      }

   fi

   command lmx "$@";

}


if [ "$all_export" == "nope" ]; then
  set +a;
fi
