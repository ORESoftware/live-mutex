Using Suman with Node.js Code Coverage tools like Istanbul, NYC, etc.

To see coverage for *one* file, you can simply run:

```istanbul cover your-test-file.js```

or for coverage of multiple files and a conglomerated report you can run

```suman --coverage <file/dir> <file/dir>```

(You may need to run ```$ suman --use-istanbul``` which will install istanbul for you.)
Suman will invoke Istanbul, and will cover each test in series, since Istanbul instrumentation is quite CPU instensive.
Suman will generate a consolidated report that represents the total coverage of your tests against your project.

//https://github.com/gotwarlost/istanbul/issues/97

This is a sketch of what you might do. 
Assuming all the entry points to your child processes are node.js files,
instead of running node foo.js run istanbul cover foo.js --dir ./coverage/dir1 , istanbul cover foo2.js --dir ./coverage/dir2 and so on. 
If all your child processes exit cleanly, they should write a coverage.json file in each of those output directories.

We then run "istanbul report" to get a consolidated report of all the coverage files.

Use ```$ istanbul help cover``` and ```$ istanbul help report``` to get an idea of all the options available.

Hope this helps. Let me know how it goes.