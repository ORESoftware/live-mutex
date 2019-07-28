#!/usr/bin/env sh

set -e;

if [ "$lmx_skip_postinstall" = "yes" ]; then
  echo "skipping r2g postinstall routine.";
  exit 0;
fi

export lmx_skip_postinstall="yes";

if [ "$oresoftware_local_dev" = "yes" ]; then
    echo "Running the lmx postinstall script in oresoftware local development env."
fi


mkdir -p "$HOME/.oresoftware/bash" || {
  echo "Could not create oresoftware/bash dir."
  exit 1;
}

cat assets/shell.sh > "$HOME/.oresoftware/bash/lmx.sh" || {
  echo "Could not create oresoftware/bash/lmx.sh file."
  exit 1;
}

(

    shell_file="node_modules/@oresoftware/shell/assets/shell.sh";

    [ -f "$shell_file" ] && cat "$shell_file" > "$HOME/.oresoftware/shell.sh" && {
        echo "Successfully copied @oresoftware/shell/assets/shell.sh to $HOME/.oresoftware/shell.sh";
        exit 0;
    }

    shell_file="../shell/assets/shell.sh";

    [ -f "$shell_file" ] &&  cat "../shell/assets/shell.sh" > "$HOME/.oresoftware/shell.sh" && {
        echo "Successfully copied @oresoftware/shell/assets/shell.sh to $HOME/.oresoftware/shell.sh";
        exit 0;
    }

    if ! command -v curl > /dev/null; then
       exit 0;
    fi

    curl -H 'Cache-Control: no-cache' \
         "https://raw.githubusercontent.com/oresoftware/shell/master/assets/shell.sh?$(date +%s)" \
          --output "$HOME/.oresoftware/shell.sh" 2> /dev/null || {
           echo "curl command failed to read shell.sh";
           exit 0;
    }
)


echo; echo "${ores_green} => lxm was installed successfully.${ores_no_color}";
echo "Add the following line to your .bashrc/.bash_profile files:";
echo "${ores_cyan} . \"\$HOME/.oresoftware/shell.sh\"${ores_no_color}"; echo;



