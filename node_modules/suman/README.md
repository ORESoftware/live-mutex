

[![Build Status](https://travis-ci.org/ORESoftware/suman.svg?branch=master)](https://travis-ci.org/ORESoftware/suman)
[![Coverage Status](https://coveralls.io/repos/github/ORESoftware/suman/badge.svg?branch=master)](https://coveralls.io/github/ORESoftware/suman?branch=master)


![alt text](https://raw.githubusercontent.com/ORESoftware/suman/master/images/suman.png "Suman Primary Logo")


 ## DOCUMENTATION
 >   Suman documentation => [oresoftware.github.io/suman](http://oresoftware.github.io/suman "Suman Docs")  
 
 This readme file contains information that you will not find in the docs and vice-versa; they will
 serve as complementary information sources.

 ---
 ---

#  Suman is a superior, singular test runner and test reporter for Node.js servers and applications.

### It is designed for maximum test performance for enterprise backend applications, via careful parallelization at almost every juncture in the testing 
### process. If your team is interested in speeding up their testing cycle, Suman is the absolute right place to look for
### answers.


###  Suman = ( AVA + Mocha + Lab )
###  It is primarily designed to supercede Mocha, and rival AVA

---

### Disclaimers: 
>
> => Suman is in beta, despite the current version number.
>
> => Suman supports Node versions >= 4.0.0.
>
> => Windows support is on the roadmap, will not be ready anytime soon.
>
> => Suman does not currently support the browser directly, but you can write a browser test with Mocha or Tape, and Suman
>   can run that file as part of the test suite. (When running multiple tests with Suman, Suman runs each in a child
>   process for speed and isolation, you can just slip in a Mocha or Tape test and everything works.)
>
> => Suman is currently Javascript and shell scripting centric. Currently Suman supports any scripting language: just
>   but a hashbang in the entry point file. In the future, however, Suman will have improved support for different 
>   languages beyond shell scripting and JS.

---

<br>
## &#9658; Installation

<br>
<i> => For command line tools:</i>
# ```$ npm install -g suman```
<br>
<i> => For test suites in your project:</i>
# ```$ cd <your-project-root> && suman --init```

* for an advanced installation method (to avoid global NPM modules) see: "Local installations only"

=> to convert a Mocha test or whole directory(s) of Mocha tests to Suman tests use <br>
```$ suman --convert --src=<src-file/src-dir> --dest=<dest-dir>```

=> to simply install Suman as dev-dependency in any project you can use ```$ npm install -D suman```, <br>
however ```$ suman --init``` is the much preferred way to initialized suman in a given project, because it will
add a directory to your project which you can move to a location of your choosing.


### Local installations only => 

If you wish to avoid global NPM module installations, we commend you, see: 
 [http://oresoftware.github.io/suman/tutorial-11-advanced-installation.html/](http://oresoftware.github.io/suman/tutorial-11-advanced-installation.html "Suman Docs: Advanced Installation") 


<br>
# &#9658; Purpose
<br>

The purpose of the Suman library is to provide the most sophisticated test runner in the Node.js ecosystem, with better
features, higher performance, improved debuggability, and more expressiveness than AVA, Mocha, and Tape. Suman is a first-rate library and we hope you
take the time to compare its capabilities with AVA, Mocha and Tape.

The primary aims are:

* Developer experience and test debuggability are above all else
* Provide a beautiful and intuitive API
* Solve all major and minor problems in the Mocha API specifically
* Make tests run faster by leveraging async I/O and separate Node.js processes
* _Isolate_ tests by running them in separate processes, so they do not share memory nor interact directly
* Make tests _independent_, so that you can easily run one test at a time (damn you Mocha).
* Make debugging your test files easier; this is achieved by allowing for the running of tests with the plain-old node executable,
this makes Suman tests "node-able"
* Provide cleaner output, so that developer logging output is not necessarily mixed with test result => 
achieved by using child processes and ignoring stdout.
* Add the missing features from Mocha, Tape and AVA, while simplifying portions of the Mocha API and doing
away with (implicit) global variables.
* Stick closely to the popular Mocha API, so that automatic conversion is possible from Mocha to Suman,
 and that transition is as seamless as possible for the developer - you do *not* have to learn a whole new API!
* Allow for maximum dynamicism so that Suman can match all use cases of users.
* Allow users to create tests with different frameworks as needed (Mocha or Tape for browser testing), 
and even in different languages, especially shell scripting, but also Java, Golang, etc.

## On lack of browser support

Suman firmly believes in integration and system testing as being more bang-for-your-buck than unit testing.
Node.js is for fast iteration, prototyping and just getting stuff done; it also makes things "easier
to change", since there is just less code to change. If you change a unit of code, your unit test may break
without adding any value, but your system test or integration test will likely not break and your system may still work as intended.
In other words, when your system test breaks - something is definitely wrong - when your unit test breaks, it's probably
just because you changed some of your code. You tell me then - which test was more valuable?
Suman recommends writing unit tests for only the complex methods and functions in your codebase. Beyond that,
we recommend end-to-end testing of diferent features in your system.

Chances are, JavaScript developers will already be familiar with a browser testing library or framework. You can point Suman
to the entry point of your test and the Suman runner will execute your tests and incorporate the result. Suman
will not be able to run much analysis on your non-Suman test process, but all it _really_ needs to be accurate is to
use the exit code of whatever child process your test is in. As stated, you can write your browser tests using any
library you wish. Using headless browser testing with Phantom.js or Nightmare.js is a very real possibility, and probably
a better use of your time than writing unit tests that run in the browser.


# &#9658; Test Framework Comparison

## The Table of Goodness


|         | Node-able                                                                 | Supports ES6/ES7  features            | Supports test isolation using  multiple Node.js processes | Concurrency within suites | Dependency Injection |
|---------|---------------------------------------------------------------------------|---------------------------------------|-----------------------------------------------------------|---------------------------|----------------------|
| Mocha   | No                                                                        | No                                    | No                                                        | No                        | No                   |
| Jasmine | No                                                                        | No                                    | No                                                        | No                        | No                   |
| Tape    | Yes                                                                       | No                                    | No                                                        | No                        | No                   |
| AVA     | No, requires transpilation first                                          | Yes                                   | Yes                                                       | Yes                       | No                   |
| Suman   | Yep, you can run any given test suite with the plain old node executable  | Yep, Suman will support all features  | Yep                                                       | Yep                       | Yep                  |


## Le Matrix of Madness

|         | Implicit globals | Forces you to use their assertion library madness  | Confusing JS contexts madness                                         | Developer debugging / console.log output mixed with test output madness                                   | no concurrency madness |
|---------|------------------|----------------------------------------------------|-----------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|------------------------|
| Mocha   | Yes              | No                                                 | Yes                                                                   | Yes                                                                                                       | Yes                    |
| Jasmine | Yes              | No                                                 | Yes                                                                   | Yes                                                                                                       | Yes                    |
| Tape    | No               | Yes                                                | No                                                                    | Yes                                                                                                       | Yes                    |
| AVA     | No               | Yes                                                | No                                                                    | ?                                                                                                         | No                     |
| Suman   | Nope             | Nope, Suman is completely assertion-lib agnostic   | Nope, Suman greatly simplifies the context puzzle that Mocha provided | Nope, Suman runner uses silent option with child_process so your output doesn't mix with the test results | Nope                   |


## The reasons why Mocha and its peers need a replacement are clear:

* In Mocha, Tape and Jasmine test files were not run in separate processes (necessary for isolation, speed and independence of test results)
* Using Mocha, Tape and Jasmine, not only was everything run in a single process, but all test cases and hooks were also run in series, which takes unnecessary amounts of time for tests utilizing async I/O
* Mocha prescribed no solution to the problem of starting up the services necessary to do system/integration testing - using Mocha/Tape/AVA it is up to the developer to manually start those services,
which makes automated testing much more difficult.
* Single process test runners like Mocha face out-of-memory issues - https://github.com/mochajs/mocha/issues/2555, these issues are
much much less likely to occur if tests are split into multiple processes
* Mocha and Jasmine could not move forward with ES6/ES7 features due to certain software patterns used (globals and complex context binding)
* a BIG ONE: clean reporting - at the command line, using Mocha and Jasmine, logging/debugging output by the developer would obfuscate the test results, nullifying any advantage of reporting tools. Suman has a simple
trick up its sleeve to allow for 100% clean reporting for any test or group of tests. 
* Mocha and Jasmine could not have certain useful serverside features, because they were also constained by running in the browser.
* Mocha lacked real ability to do true dynamic testing (meaning, registering a dynamic number of it() test cases) => e.g., make a network call, get X values, create a test case for each.
* Mocha had confusing and obfuscated context values (values for 'this'), which we have greatly simplified, allowing for the usage of arrow functions, etc 
* Mocha, Jasmine and Tape lack some other nice features that are implemented by Suman. For example, Tape's ability to pre-load modules using the command line 
before running tests is nowhere near as powerful or easy to use as the dependency injection ability of this library.
* Using Mocha, Tape, Jasmine you could not easily pass data to tests, to reuse the same test code for different scenarios; Suman allows you to pass dynamic data
to tests using dependency injection.
* cannot call tests programmatically without wrapping Mocha test suite in a function, Suman allows you to call tests programmiatcally, without having
to wrap tests in a function.
* After writing a few Mocha tests, developers will find it's very difficult to properly run only one test - the "only" feature can help,
but there are so many bugs that can crop up because of this, especially if you have some global hooks that need to run before your "only" test needs
to run. Suman solves this problem ridiculously well, because Suman was designed to solve this very problem from the ground up. 


## Suman Philosophy 

* "Just works" - no need for addons or plugins, unless you want to write a custom reporter
* Fail-fast
* Stick to Node core modules
* Unlike AVA, you don't need to transpile with Babel if you don't want to: _as ES6 generators + Promises
 can give you the same coding patterns as ES7 async/await_
* Use streaming APIs when possible and reasonable
* Provide a full-featured, non-dumbed-down API that's easy to get started with, and
both powerful and intuitive to use over the long-run.
* Listen to what the community wants.
* Leverage Javascript's strengths (ahem *closures*)
* Don't be lazy.
* As Suman is a command line application, we can utilize a more functional programming style
* Details matter*


# &#9658; Suman features in detail:

* <b> basics </b>
    * => tdd/bdd interfaces 
    * => easy migration from Mocha (it's automated using the --convert option)
    * => extremely powerful features, while aiming to be straightforward, clean, concise, consistent and accurate; 
    * => designed with ES6 and ES7 in mind, including Promises, generators and async/await 


* <b> Improved mechanics, syntax and semantics </b>
    * singular param (t) is used for all hooks and test cases, in the style of AVA
    * Pass data from test cases directly to hooks using the t.value option of a test case
    * Pass data from hooks directly to test cases using the t.data value
    (neither are possible with Mocha, and are very much a missing feature)
    * encapsulation and immutability are utilized much more effectively than with Mocha etc
    * instead of a "grep" option like Mocha's, we have "match" because we are filtering input not output!
    
  
* <b> Full-blown concurrency</b>
    *  your tests will run much faster, especially if they are doing lots of network I/O
    *  test files are run in separate Node.js processes for speed, isolation and independence
    *  test cases and hooks in any given suite can be run concurrently, when using asynchronous I/O, 
    using the "parallel" option in your code
    *  capability to control maximum number of processes running at a time (cap it at 6 processes, or 18 processes or whatever)
    *  capability to add constaints to prevent any given pair of tests from running at the same time, (if two different tests access the same
    external resource for example, and you don't want the interaction to cause false negatives).
       
       
* <b> Improved reporting </b>
    *  using the Suman test runner, you can prevent any logging output from mixing with test reports, by redirecting stdout from the child process(es).
    *  Future effort: Suman includes a built-in web reporter that you can use to share test results with your team, using the Suman server
    *  Future effort: Suman server provides ability to store past test results (backdata) and view test results chronologically with browser to look at trends
    *  Future effort: testing backdata is stored in a local SQLite database 
     which will allow you to run real queries on your test results, and share results with your team.)
    
* <b> Automatic test execution and/or test transpilation </b>
    * Using ```suman --watch``` you can execute test files or transpile test files as you write them
    * Suman watcher processes run your tests and pipe stdout/stderr to log files which you tail with a terminal or browser window
    * Running tests on the fly is a major portion of the optimal Suman workflow, and makes it all the more fun.
       

* <b> Dynamicism
    * If there's anything you want to do with a test runner, you can do it with Suman
    * Test files themselves allow for all sorts of dynamic behavior, dynamic and asynchronous test case generation, etc
    * You can call tests programmatically and use them as macros
    * Suman tests can create child processes which call Suman tests, etc etc.
    
       
* <b> Use suman.once.js to run hooks before the test runner starts </b>
    * these hooks can be used to start the services necessary for any given test file to run successfully; they only run once no matter how many tests are run, are only run
    if tests declare so. They offer a lighter weight option than containers for starting up the necessary servers in your backend system.
    *  Your suman.once.js file can augment the behavior of container build scripts etc, to help start up services necessary for testing to commence
       
       
* <b> Very simple but powerful dependency injection (DI/IoC)</b>
   *  Inject dependencies sourced synchronously or asynchronously
   *  Most useful for injecting values acquired _asynchronously_, such as successful network connections and database values
   *  Inspired by familiar tools such as Angular and RequireJS
   *  Inject any core/"built-in" Node.js module by name, with zero configuration
   *  DI is used throughout the library, and relieves the burden on the developer to remember order of parameters
   *  Inject network values, test dependencies and library dependencies
    
    
* <b> Test runner tuning </b>
    *  Add contraints to prevent any given pair of tests from running at the same time
    *  Cap the total number of processes running at the same time
    *  Suman 'once' feature gives the developer the option to run checks to see if all necessary network components are live before running any given test

    
* <b> Easy migration from Mocha </b>
    *  Suman includes a command line option to convert whole directories or individual Mocha tests to Suman tests
    *  before/after/beforeEach/afterEach hooks behave just like in Mocha
    *  solid command line tools and better grep facilities than predecessors
    *  skip/only also work like Mocha
    
    
* <b> Optional but first-rate transpilation features </b>
    * Suman support for tranpilation is first-rate
    * Suman allows you to use "babel-register" to transpile your sources on the fly or transpile a src directory to a target directory
    * If you have less than ~20 tests, the recommended way to incorporate Babel in your testing is to simply transpile your entire "test" directory to "test-target"
    * Using a "test-target" directory instead of "babel-register" allows for better debugging, performance and transparency in your testing system
    * If you have more than 20 tests, Suman does not recommend transpilation, due to the performance penalty.
    * For enterprise usage, we don't expect many teams to use transpilation features anyway; it's more likely individual developers who may
    wish to use Babel to transpile tests for a library.


* <b> Log files help you debug </b>

    * Using Suman tests, you have 3 options as to how you execute a test file: ```1. node x.js, 2. suman x.js and 3. suman --runner x.js```
    * Using the Suman runner, your test file(s) all run in child processes. This can make debugging harder, but Suman sends all stderr from the child processes
    to a single log file to help you debug.
    * Normally, to debug a test, you would run the test with node or using suman without using the runner, but if you see a problem with a particular test that only
    occurs when using the runner, then the log files will help.

* <b> Freedom: Suman is not highly opinionated, but gives you powerful features</b>
    *  Suman prefers the standard core assert Node module (Suman has unopinionated assertions), but like Mocha you can use any assertion lib that throws errors
    *  Callbacks, promises, async/await, generators and event-emitters/streams are supported in any test case or hook.


## Suman design

* no implicit globals in test suite files, which were avoided due to the problems they caused for Jasmine and Mocha.
* Suman uses domains to isolate errors in asynchronous tests and hooks, and currently this is the only solution to this problem at the moment. 
Lab, the test runner for Hapi servers, also uses domains for this same purpose, and using domains allows for much better coding patterns (avoiding globals in
the suman library.) Domains are facing deprecation, and Suman will replace domains with whichever suitable replacement is chosen by the Node.js core team,
although after talking with many people near to core, domains will be supported for quite some time. As it stands, _Suman is a perfect use case for domains, 
as untrapped errors are supposed to be thrown in test code_ (assertions, etc), and the developer experience in this library will be better than any other test library because of the use of domains, as they basically
guarantee that we can pin an error to a particular test case or hook, no matter where the error originated from.

## *Details matter

    * we designed Suman with details in mind
    * fewer logical branches and contingencies than Mocha WRT rules for hooks
    * much better semantics, with new standard functions alongside Mocha's 'done' callback: 'ctn', 'pass', 'fail' and 'fatal' are new functions
    each with a unique purpose and meaning, and done is still in Suman's API with the same meaning as Mocha!
    * friendly error messages, that also get sent to suman-stderr.log for reference
    * when debugging, (the debug flag is set) timeouts will automatically be set to 'infinity'


## We can say with confidence that Suman is the most powerful test framework for serverside JavaScript on planet Earth
 => as it gives the developer total control and access to a very large set of features, with the explicit goal of being bug-free first, full-featured second.


## Simple usage examples

#### example using ES6/ES7 API:  

<i> Suman is as simple as you want it to be; but it's also packed with features that you can use. </i>

```js

import * as suman from 'suman';
const Test = suman.init(module);


Test.describe('ES6/ES7 API Example', function(baz, assert, path, http){   // this is our root test suite.

    // we have injected some core modules by name (http, assert, path) 
    // we have also injected a module from our own project, baz
    

     this.beforeEach(t => {
     
       const req = http.request({
          hostname: 'example.com'
        }, res => {
        
           var data = '';
           
           res.on('data', function($data){
                  data += $data;
           });
           
           res.on('end', function(){
                  t.data.foo = data;
                  t.done();
           });
        
        
        });
        
        req.on('error', fatal);
        req.end();
        
     
     });


     this.it('detects metal', t => {
         assert(t.moo = 'kabab');             
     });

     
     this.it('ES7 is not necessary because we can achieve the same thing with generators', async t => {
     
        const val = await baz.doSomethingAsync();  
        assert(path.resolve(val.foo) === '/bar');
         
     });

     this.it('you dont need to transpile, because achieves the same as above', function*(t){

        const val = yield baz.doSomethingAsync();
        assert(path.resolve(val.foo) === '/bar');

     });

});


```

### basic ES5 API:

<i> It is recommended to avoid adding the extra complexity of transpiling your tests from ES7</i>
<i> So using ES5 with some sprinkles of ES6 is just fine :)</i>

```js

const suman = require('suman');
const Test = suman.init(module);  


Test.describe('ES5 API Example', {mode: 'parallel'}, function(delay, assert, fs){

   //we have declared the root suite to be parallel, so all direct children will run in parallel with each other

    this.describe('child block 1', function(){     //test cases will run in parallel with child block 2,3

        this.it('red wine', t => {
             assert(true);
        });

        this.it('white wine', t => {
             assert(true);
        })

    });


    this.describe('child block 2', function(){    //test cases will run in parallel with child block 1,3

        this.it('lager', t => {
             assert(true);
        });

        this.it('IPA', t => {
             assert(true);
        })

    });


    this.describe('child block 3', function(){    //test cases will run in parallel with child block 1,2


     // child block 3 is not declared to be parallel, and
     // because series is the default, its direct children will run in series

         this.describe('child block a', function(){    //test cases will run in series with child block b




         });

        this.describe('child block b', function(){    //test cases will run in series with child block a




         });

    });

});



```


### More Suman Examples

* see:  /examples directory
* see:  https://medium.com/@the1mills/introducing-suman-a-node-js-testing-library-20fdae524cd

### SLA

The Service Level Agreement is that Suman will constantly be up-to-date with the newest features available via the node executable.
We will focus on what's in Node and not what's available in Babel or other transpilers. That being said, we will also work to ensure Babel features are also supported,
but we will primarily focus on making Suman completely bug-free when it comes to the latest version of Node, not the latest abilities of Babel or the like.
By the time any ES6/ES7/ES8 feature is available in Node, it will be supported by Suman. We want to emphasize the utility of the option of running things
with the plain old Node executable, as opposed to adding the complexity of transpilation.


### Execution modes for a single test file

You can execute a test file with the plain ```node``` executable, with ```$ suman``` and with ```$ suman --runner```

Here are the differences between the 3 options:

|                         | $ node a.test.js  | $ suman a.test.js  | $ suman --runner a.test.js  |
|-------------------------|-------------------|--------------------|-----------------------------|
| command line options    | no                | yes                | yes                         |
| runs multiple processes | no                | no                 | yes                         |
| suppress stdout/stderr  | no                | no                 | yes                         |
| easy to debug?          | easy              | medium             | hard


In order to run multiple files, you must use ```$ suman --runner```; the above table
only pertains to running a single test file (usually when developing a particular test.)


### FAQ

* Q: Why dependency injection in Node.js? Isn't it a waste of time?
  
  *  A: Normally it is. Dependency injection is very useful in the browser and is used by both Angular and RequireJS. In Node.js we usually have all our dependencies or we can easily load
     our dependencies synchronously on demand with the require function. However, with test suites, it was until now impossible to load dependencies and values *asynchronously* before registering test cases.
     DI allows you truly awesome ability to create and procure values asynchronously before any tests are run, and injecting the values in any test suite you wish.
     
* Q: Can I use arrow functions? 

  * A: Yes you can use arrow functions everywhere *except* for the describe callbacks


### Important aside - How is Suman better than AVA?

 It should be abundantly clear why Suman is better than Mocha, but how is Suman better than AVA? 
 Suman borrows some excellent features from Mocha that AVA seems to ignore, including the ability
 to use nested describe blocks for more control and preventing the sharing of scope within tests. AVA basically
 co-opted Tape and added concurrency. Suman co-opted Mocha, added concurrency, better reporting, dependency injection and 
 less confusing contexts for callbacks. Suman has more powerful facilities for asynchronous testing than AVA due to Mocha/Jasmine-style hooks
 and nested describes. Dependency injection also makes Suman extremely convenient and fun to use, compared to AVA.
 Suman is simply more powerful and richer in features than AVA. 
 
 * AVA test are not "node-able" - you *cannot* run them with node directly; Suman tests are node-able, which makes 
 debugging so much easier and intuitive! Note that Suman does make is easy for developers to debug child processes.,
 giving them built-in tools to do so.
 
 ![alt text](https://github.com/ORESoftware/suman-private/blob/dev/images/ava-prob.png)
 
 * AVA requires Babel transpilation, which adds unnecessary complexity for test environments, and is also much slower
 * AVA does not handle errors thrown in asynchronous code gracefully, Suman is much better in this regard.
 * AVA does not feature the nested describes of Mocha or Suman, which limits the expressiveness of the library
 tremendously
 * AVA expects you to use its assertion library, whereas Suman will accept usage of any assertion library that
 you are already familiar with.
 * Furthermore, AVA does not prescribe solutions to common test problems -
 
        * registering dynamic test cases (given a dynamic value acquired asynchronously)
        * starting up necessary services before running tests
        * injecting different dependencies into test files
        
 
 Alternatively, with Suman:

 *Suman has nested describe blocks, which are imperative for non-trivial tests; a simple but common example is a before hook that you want
 to run only for a certain subset of tests in your test file. The before hook and tests would go in a nested describe block.
 *Babel transpilation is totally optional - you can achieve the async/await pattern with generators and promises alone, you don't need ES7 for this
 *Suman uses domains to correctly map runtime/assertion errors to test cases and hooks, 
 which provides a much more reliable and well-designed piece of software because it can handle any error that gets thrown, not just assertion errors.
 

### Contributing - Testing and pull requests
 
 (Please see contributing.md)
 
 Suman uses itself to test itself :)
 The right way to do this is as follows:
 
 ```
 git clone https://github.com/ORESoftware/suman.git &&
 npm install &&
 npm link &&
 npm link suman &&
 npm test
 ```
 
### Extra info

If you are familiar with Mocha and enjoy both its power and simplicity, you may prefer Suman over Ava,
and Suman provides the simplest migration path from Mocha. As was stated AVA draws more from Tape and Suman draws more from Mocha. 
Suman was designed to make the transition from Mocha to be as seamless as possible.

** dependency arrays of strings exist so that during minification we can still know where to inject dependencies, that's why Angular and RequireJS have deps arrays of strings - they don't get
corrupted by minification/uglification. But for backend testing frameworks, it is very unlikely we need to minify, so we don't need the dependency array.

Note that because Suman should be installed as a devDependency, it won't show up as being used in the standard
NPM badge:
<br>
<br>
[![NPM](https://nodei.co/npm/suman.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/suman/)
<br>
<br>


<br>
# &#9658; Even more about Suman
<br>

<i>

Suman is a new test runner for Node.js and is focused on high-throughput maximum concurrency asynchronous testing of backend services.
High concurrency testing is not just good for performance, it encourages you to write "threadsafe" application code and test code.
As Node.js developers, it's easy to be complacent about thread safety since your code is running on a single thread, 
but that doesn't mean concurrent access to external resources won't happen.

This project summarily improves Mocha on every level, and also borrows excellent features from Tape/AVA such as the plan features and
the use of t as a singular param to both hooks and test cases. It all gels together quite nicely into a library that is much more 
powerful than both AVA and Mocha. _The biggest advantage Mocha has over Tape/AVA is the nested describe/suite blocks_. These are huge
once you start writing non-trivial tests. **By the way, conversion from Mocha to Suman is automated with this library.** The other advantage of Suman
is that Suman does not require transpilation - AVA does require transpilation - which adds a lot of complexity and overhead that you may not want. We don't need Babel
to have good features, nor do we need to transpile to get ES7 async/await behavior as this can be achieved with ES6 generators + promises!
Those using AVA or Tape who want something more powerful, and no more complex, will find the answers here.

Suman is feature-rich and very fun to use, because it has the same hooks and patterns as Mocha which we can all admit are quite fun to use. 
Suman is designed to be a direct successor to Mocha, Tape and Jasmine, and to compete with the new Node.js test runner AVA;
it's aim is to be more sophisticated and featureful than the competition.
Suman was designed so that there would be a super simple migration path from Mocha to Suman, but also provide
massive improvements over Mocha, specifically for backend testing. 

Mocha is most familiar to us and perhaps to you - Mocha was a great test library, but has many bugs and shortcomings 
that we experienced ourselves over time, and eventually we wanted a test runner that we could use that was more robust and more streamlined than Mocha.
As experienced Mocha users, we know exactly what Mocha is missing (but we will take feature requests from you too!). 

Suman is designed for powerful and full-featured testing of integrated and asynchronous networked systems,
and is not currently intended to be used for front-end testing. (Your backend testing framework and front-end testing framework should probably be different if you
want them both to be powerful and full-featured). This library gives you features for backend testing that are not available in other testing frameworks since this
library is not constained by the requirement that it must run in the browser. The bottom line is that all the problems with Mocha were fixed by this library.
If you have a special question, concern or requirement don't hesitate to open an issue to see if Suman has you covered.</i>

Note: Suman is *not* designed to and cannot be run in the browser - it is designed for maximum performance of backend testing.


 <br>
 <b>Looking for open source dev(s): </b>
 <br>
 Suman is currently looking for a full-stack web developer experienced with both Node.js and React to split the plaudits for this project,
 and who is interested in contributing to open source with the notion that it's very unlikely any monetary gains will be seen from it :)
 This project yearns for a really excellent web reporter UI and corresponding backend to support it,
 and what we have now is just the beginning when it comes to the web reporter.
 
 Here is a screenshot of the web reporter as it is now:  https://goo.gl/LE5xLo
 
 With some work it could prove to be indispensable for developers working with this lib. This project is very multifaceted and
 it will involve full-stack work with SQLite, Express and React. Relative newbs welcome. Thanks!
 
<br>


<style>
.theBlackBackground {background-color:#000;color: red;}
</style>

<textarea id="source">

class: middle, center, theBlackBackground
# Title
</textarea>
