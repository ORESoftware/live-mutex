#!/usr/bin/env bash

get_latest_lmx(){
  . "$HOME/.oresoftware/bash/lmx.sh";
}

lmx(){

   if ! type -f lmx &> /dev/null || ! which lmx &> /dev/null; then

      npm i -s -g 'live-mutex' || {
         return 1;
      }

   fi

   command lmx $@;

}

export -f lmx;
export -f get_latest_lmx;