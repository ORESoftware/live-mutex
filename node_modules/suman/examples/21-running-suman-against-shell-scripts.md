

 ## Hooking in shell scripts
 
 ###  => calling shell scripts instead of .js files from the test runner


* Make sure to put a hashbang at the top of your shell script => e.g. ```#!/usr/bin/env bash```,
 this ensures your script will be run with the correct interpreter (bash, sh, zsh, etc). Suman uses
 child_process.spawn('/absolute/path/to/your/script'), so your script needs to be executable, and have
 the hashbang.

* Your shell script can either:

    1. run its own tests, without invoking any JavaScript at all, and just return a 0 exit code upon success, 
    or non-zero exit code otherwise.

    2. do some environment setup, and then invoke JavaScript or a Suman test file. The Node.js process will inherit 
    the correct environment and file descriptors and be able to communicate with the runner as normal.
    
* You are responsible for ensuring that the shell script gets invoked, but that any .js files that the shell
script calls are not also called by the suman runner. Suman recommends that you do some directory organization
and/or using the --match option to use regex to match against the shell scripts you want to run, but not the
.js files that the shell scripts are responsible for invoking.
