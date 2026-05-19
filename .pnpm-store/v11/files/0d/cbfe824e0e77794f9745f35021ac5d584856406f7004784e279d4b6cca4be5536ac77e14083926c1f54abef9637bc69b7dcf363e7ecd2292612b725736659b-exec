#!/usr/bin/env sh

set -e;

if [ "$skip_postinstall" = "yes" ]; then
    echo "skipping postinstall routine.";
    exit 0;
fi

export FORCE_COLOR=1;
export skip_postinstall="yes";

mkdir -p "$HOME/.oresoftware/bin" || {
  echo "Could not create .oresoftware dir in user home.";
  exit 1;
}


if [ "$(uname -s)" != "Darwin" ]; then
   exit 0;
fi


install_realpath(){
  curl_url='https://raw.githubusercontent.com/oresoftware/realpath/master/assets/install.sh';
  curl  -H 'Cache-Control: no-cache' --silent -o- "$curl_url" | sh || {
     echo "Could not install realpath on your system.";
     exit 1;
  }
}

realpath_path="$HOME/.oresoftware/bin/realpath";

if [ ! -f "$realpath_path" ]; then
    install_realpath
    exit 0;
fi

if command -v gdate > /dev/null; then
  modified_secs="$(gdate -r "$realpath_path" +%s)"
else
  modified_secs="$(date -r "$realpath_path" +%s || echo '100')"  # if date -r is not defined, then just use a low integer
fi

current_secs="$(date +%s)"
diff="$(expr "$current_secs" - "$modified_secs")"

if [ "$diff" -gt '500000' ]; then
    install_realpath
    exit 0;
fi





