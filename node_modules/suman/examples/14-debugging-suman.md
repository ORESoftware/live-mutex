

# Debugging Suman tests and via the Suman runner


## Debugging using logs (stdout/stderr)

If you see an exception/error with a test that was executed via the Suman runner, that does not occur when running the test in a single-process, your best bet is to use
logging facilities to debug, unless you are currently expert in debugging child_processes. Note that if the same problem occurs for a particular test with the runner and running the test directly, debug it first directly using node
or suman without the --runner flag.

debugging tips - "use strict", verbose flags, log files, SUMAN_DEBUG

When using the Suman runner, stdout and stderr for every test file will be logged to 
suman/runner-stdout.log and suman/runner-stderr.log respectively.

When developing Suman tests, we recommend tailing these log files:



## Debugging via debugging tools


1. With node debug

node debug is the "native" node way of debugging node applications

<span style="background-color:#FF8C00">&nbsp;```$ node debug a.test.js```</span>



2. With Node inspector


first make sure you have node-inspector installed for command line use (installed globally):

<span style="background-color:#FF8C00">&nbsp;```$ npm install -g node-inspector```</span>

 
 if we want to debug a test directly
 
<span style="background-color:#FF8C00">&nbsp;```$ node-debug a.test.js```</span>
 
 
 or using the suman executable and the command line options that come with it:
   

```$ node-debug suman a.test.js --timeout=500000```  //everything in single-process

```$ node-debug suman a.test.js --timeout=500000 --runner```  /// we want a challenge, will debug via the runner

``` 
/usr/local/bin/node --debug-brk=63823 --expose_debug_as=v8debug 
/Users/t_millal/WebstormProjects/oresoftware/poolio/test/test-src/poolio-w-suman.test.js
```


3. With Webstorm

Webstorm has a fantastic in-IDE debugging tool.


# Debugging the Suman runner

If a test is failing using the runner, here are the steps you should take to debug:

1. Try running that test file in isolation, using ```node x.test.js``` or ```suman x.test.js```

2. If the error doesn't show up in Step 1, then try running this: ```suman test.js --runner```, this will tell Suman to use the runner even
though you are only running one test file. Suman is designed to make debugging easier, so the runner is not used by default when
you are only running one test file, which means you can avoid debugging child processes. During this step, check the runner logs at
```<suman-helper-dir-root>/logs/runner-debug.log```. The value for ```<suman-helper-dir-root>``` is defined by the ```sumanHelpersDir``` property in your 
 suman.conf.js file.

3. If the original error still doesn't show up, then perhaps there is some interaction in your tests happening - perhaps they are both accessing
the same external resource. What you should do is run Suman with the ```--concurrency=1``` option, 
so that only 1 test runs at a time with the runner.

4. TBD