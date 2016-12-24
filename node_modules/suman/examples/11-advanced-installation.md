
As many experienced Node.js and NPM users may know, global modules present several problems to developers.

<i> => One of the biggest problems is that the global module version may differ from the local one.</i>

Furthermore, when using ```NVM``` and switching between ```Node.js``` versions, 
we may lose sight of globally installed packages which we may depend on for command-line tooling etc.

One solution to this problem is to avoid installing packages globally altogether, and Suman is designed to handle this.

Follow these steps.

```npm install -D suman@latest```  (in your project root)

and now the suman command line is available with  ```./node_modules/.bin/suman```

in order to install properly, please then use ```./node_modules/.bin/suman --init```

and now, if you want to get fancy, put the following line in your .bash_profile or .bashrc (or whatever, if you zsh, etc)

<span style="background-color:#FF8C00">&nbsp;``` alias suman = "TBD" ```</span>

Now, even if you switch Node versions with NVM, ```$ suman ``` will still be available.

