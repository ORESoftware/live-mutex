
<img align="right" width="20%" height="20%" src="https://raw.githubusercontent.com/sumanjs/suman-docs/master/images/suman-hex.png">

[![npm version](https://badge.fury.io/js/suman.svg)](https://badge.fury.io/js/suman)

[![Greenkeeper badge](https://badges.greenkeeper.io/sumanjs/suman.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/sumanjs/suman.svg?branch=master)](https://travis-ci.org/sumanjs/suman)

[![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/1072/badge)](https://bestpractices.coreinfrastructure.org/projects/1072)

[![Coverage Status](https://coveralls.io/repos/github/sumanjs/suman/badge.svg?branch=master)](https://coveralls.io/github/sumanjs/suman?branch=master)


# Suman: universal test runner - run tests in the language of your choice.

Designed to run tests written in any language - because Suman runs tests as child processes - just write TAP to stdout
via the runtime of choice (Golang, Java, Python, Node.js, Bash, whatever). 

<p>
Suman is intended for unit testing in the browser, for backend and system testing,
for end-to-end testing with Selenium, etc.

<p>
Originally designed for TypeScript and Babel transpilation, Suman was generified to support
compiling from source to target for <i>any</i> language. Suman is written in TypeScript, and has strong support for TS.
All in all, Suman is a batteries-included test runner which encourages testing best practices through its design. 
Starting with Suman is very easy, but you will find it has extremely powerful features, as your demands increase.

<p>
<b>Perhaps most importantly, Suman makes testing significantly faster for both CPU bound and I/O bound test suites.</b>
<b>The speed benefits are generally most useful during test development</b>

<p>
As final points, Suman is designed to be universal and not just another JS framework - it's designed for the long-haul. 
<p>
Elegance and utility of reporting output is paramount to the Suman philosophy.
Reporters are the best place to contribute for people interested in creating beautiful test output.
As they say (visual) design is what really separates contenders in a world of surplus.
<p>


# Purpose of project
>  I wrote Suman because I found test runners and test harnesses in the Node.js ecosystem to be lacking.
>  I consider Mocha to be woeful, and AVA to be slow, under-featured and too tightly coupled with Babel.
>  If your team is interested in speeding up your testing cycles, Suman is the absolute right place to look for answers.
>  Suman is designed to be 'better all-around' than AVA, TapJS and Mocha, etc. Reading the issue tracker for Mocha
>  made it very apparent that Mocha was never going to be vastly improved. If you look at the Karma codebase, you
>  also find that it's not designed with Webpack, TypeScript or Babel in mind, etc.
>

# The Suman Challenge

If you can find a problem that Mocha or AVA has, which Suman does not solve, I will find some reward for you. 
<br>
Suman was written so that it would suffer from none of the problems that existing test runners have.


### &#9658; Disclaimers: 
>
> Suman supports Node versions >= 6.0.0, since it makes heavy use of the Proxy class and Symbol primitives.
>
> Windows support is on the roadmap, but will not be ready anytime soon. Currently, MacOS and *nix support only.
>
> Browser will be supported, but not until ~Summer 2018.
>

----------------------------------------------------------------------------------------

# Expected official release date

Suman is not officially released yet - expected release date ~October 2017.
Until then, expect bugs, missing docs, etc. Proceed at your own risk :D


# &#9658; Documentation 

 The Suman docs [sumanjs.org](http://sumanjs.org "Suman Docs")  

-----------------------------------------------------------------------------------------


## Suman is made up of two independent pieces:

1. A CLI that can run a test in any language, and is designed to handle transpilation/compilation for any language as well.
2. A super powerful test harness that can be used with JavaScript/Node.js tests. This test harness is highly recommended
 and has strong support for TypeScript.

The CLI can be used to run tests in any language; on the other hand, 
the test harness, only works with Node.js and browser based JS.

You do not need the suman CLI to run suman tests. <br>
You do not need to run suman tests to use the CLI. <br>
They are completely independent, while obviously being designed to work great together. <br>

<p>

--------------------------------------------------------------------------------------------

## What makes Suman better and different

<div> Everything about Suman is designed for parallelization. </div>

Suman is not just better than test runners in Node.js and JS land - it improves on test runners written
for other languages as well. This is primarily because the Suman CLI is built so that you can have complete control 
over the parellization of your tests. You can select which tests should exclude each other and run in series,
and which tests should run in parallel with each other. In the _long run_ however, all tests should run in parallel
in their own container with their own resources. In the _long long run_, each container should run on its own hardware,
all in the name of speed. Suman has an experimental feature called "suman groups" which will allow you to group your
tests together and assign a group to a container. Eventually the dream is support the assignment of each container
to its own hardware, using different cloud platforms.

___

# Top 5 reasons to use Suman, instead of Mocha or AVA

1. Run tests in any language or executable, not just Node.js/JavaScript.

2. => You can run Mocha tests and AVA tests using the Suman CLI, but not the other way around!

3. Easily containerize any test process in development, using `suman --ctrz x.js`

4. Imagine you're a senior developer and a more junior developer joins the team, 
and they write a new test that brings down the whole CI/CD pipeline. With Suman, tests don't directly 
interact because they are run in separate processes; in Mocha, not so much. Avoid that fateful day.
Using Suman, it will be clear which test process is causing the fatal problem; but with a single process
it will not necessarily be clear that it is the junior developer's test which caused the issue.

5. Suman is much faster than AVA, because Suman does not require transpilation.

<p>

# Suman CLI features

```console
$ suman> 
```

<p>
<div> ✓ <b style="color:purple">  tests can all run in parallel, in separate processes </b> </div>
<div> ✓ <b style="color:purple">  agnostic </b> => want to learn a new language? write a test script with language X, then run the test with Suman.</div>
<div> ✓ <b style="color:purple">  flexible, generic, robust </b> =>  CLI can run JS tests directly, or in a child process </div>
<div> ✓ <b style="color:purple">  flexible, generic, robust </b> =>  Composability => Suman tests can run other Suman tests (in child processes). Sumanception! </div>
<div> ✓ <b style="color:purple">  test isolation </b> =>  each test can run in its own process </div>
<div> ✓ <b style="color:purple">  test independence </b> =>  easily run only one test at a time (unlike other Node.js test runners...)</div>
<div> ✓ <b style="color:purple">  "nodeable test scripts" </b> => run individual JS tests with the node.js executable</div>
<div> ✓ <b style="color:purple">  supports unit testing in the browser </b> (tested on Chrome and Firefox)</div>
<div> ✓ execute tests written in <b style="color:purple">any</b> language, use write TAP to stdout</div>
<div> ✓ synchronous <b style="color:purple">*and*</b> asynchronous reporters (!) Your reporter can be async.</div>
<div> ✓ execute tests written in <b style="color:purple">any</b> language, use write TAP to stdout</div>
<div> ✓ Complete control => You *can* run JS unit tests all in the same process for speed, as needed. </div>
<div> ✓ <b style="color:purple">  bash completion is available for the Suman CLI :D </b>
</p>


## Suman test harness features

```javascript
import * as suman from 'suman';
```

These are the features for creating tests in JavaScript/TypeScript.

<p>
<div> ✓ <b style="color:purple">  fully asynchronous </b> => allows for easy, dynamic test case creation
<div> ✓ <b style="color:purple">  agnostic </b> => works with your favorite assertion library; Suman is also bundled with Chai, if you wish to use that.
<div> ✓ <b style="color:purple">  no globals </b> =>  no global variables as part of test harness - therefore JS tests can be run with Node.js executable </div>
<div> ✓ <b style="color:purple">  flexible, generic, robust </b> =>  CLI can run JS tests directly, or in a child process </div>
<div> ✓ <b style="color:purple">  test isolation </b> =>  each test can run in its own process </div>
<div> ✓ <b style="color:purple">  declarative style </b> => declare (sync and async) dependencies for each test, and only load those</div>
<div> ✓ <b style="color:purple">  supports unit testing in the browser </b> (tested on Chrome and Firefox)</div>
<div> ✓ <b style="color:purple">  supports observables (RxJS5) </b> </div>
<div> ✓ only <b style="color:purple">18mbs </b> on filesystem as npm install -D</div>
<div> ✓ works with <b style="color:purple"> Selenium </b> (use selenium-webdriver, wd, or webdriver.io)</div>
<div> ✓ Built-in watch features => Watch files, and run tests on changes </div>
<div> ✓ Complete control => You *can* run unit tests all in the same process for speed, as needed. </div>
</p>

 ---

##  Suman is a singular test runner focused on Node.js and front-end JavaScript, but is both generic and robust so that it can run tests in any runtime or language


Suman is written with Node.js, and is focused on testing Node.js code, 
but can run tests written in any language, not just JavaScript. This is 
because it can run tests in child processes and collect results using TAP (Test Anything Protocol, via stdout), IPC, or websockets.

Suman can run a test in any language which exposes a script with a hashbang or a binary entrypoint file (e.g. Golang or C).
To run Java tests, where Java does not compile to binary and where you cannot put a hashbang in a .class file,
you would need to call Java from a shell script.

It is designed for maximum test performance, via careful parallelization at
every juncture in the testing process/pipeline. 

-----


# &#9658; Installation

<i> For command line tools:</i>
## ```$ npm install -g suman```

=> **Please** do *not* use sudo to install suman globally; if you need to use sudo, then something is probably wrong
=> See: https://docs.npmjs.com/getting-started/fixing-npm-permissions
=> To avoid any problems with permissions, Suman recommends usage of NVM

<i> For test suites in your project:</i>
## ```$ cd <project-root> && suman --init``` 

* To avoid global NPM modules see: "Local installations only"

=> to convert a Mocha test or whole directory(s) of Mocha tests to Suman tests use <br>
### ```$ suman --convert --src=<src-file/src-dir> --dest=<dest-dir>```

=> to simply install Suman as dev-dependency in any project you can use ```$ npm install -D suman```, <br>
however ```$ suman --init``` is the much preferred way to initialized suman in a given project, because it will
add a directory to your project which you can move to a location of your choosing.


### &#9658; Local installations only => 

If you wish to avoid global NPM module installations, we commend you, see: 
 [http://sumanjs.org/tutorial-11-advanced-installation.html/](http://sumanjs.org/tutorial-11-advanced-installation.html "Suman Docs: Advanced Installation") 


## Example commands

```bash 

 suman test/**/*.py   # run python tests
 
 suman test/**/*.rb   # run ruby tests
 
 suman test/**/*.sh  test/**/*.go  # run bash and golang tests
 
 suman test/src/*.spec.js --concurrency=6 # run the matching tests, no more than 6 Node.js processes at a time.

 suman -w project   # run a set of tests when a project file changes

 suman -w tests   # when developing a test, run it upon changes
 
 
```

## The Suman Story

The human side of this endeavor. (A link to docs will be here soon.);


### Suman uses several intelligent pieces of setup:

Global installations of Suman simply look for local installations to run. So if you run the suman command installed via npm install -g suman, that CLI
will just invoke the local installation of suman in any given project - this prevents any potential 
conflicts if there is a difference between the global/local module versions. Excellent!

If you use NVM and switch between Node.js versions, you can use bash functions (provided by SumanJS) which will 
denecessitate the need for any global installations of Suman at all.

Suman is designed to interop well with the most common libraries in the ecosystem for handling asynchronous code.


## Simple example

```js

import * as suman from 'suman';
const {Test} = suman.init(module);

Test.create('example', (baz, http, beforeEach, context, inject, foo, x, beforeAll) => {

  // Suman uses simple old-school style JavaScript DI
  // we have injected some core modules by name (http, assert, path)
  // we have also injected a module from our own project, baz

  inject('bar', () => {
    return baz(foo).then(v => {
      return v.filter(val => val.isGreen())
    })
  })

  beforeAll(h => {
    return x.anything().then(function(v){
      h.assert(typeof v === 'boolean');
      h.$inject.v = v;
    });
  });

  beforeEach(t => {
    t.data.v = (t.value.v * 2) + t.$inject.v;
  })

  context('foo', {mode: 'series'}, (bar, it) => {

    it('a', {value: 5}, t => {
      t.assert.equal(t.title,'a')
      t.assert.equal(t.data.v,10)
    })

    it('b', t => {
      t.assert.equal(t.title, 'b')
    })

    it('c', t => {
      t.assert.equal(t.title, 'c')
    })

    context('nested child', {mode: 'parallel'}, (bar, it) => {

      it('a', t => {
        t.assert.equal(t.title, 'a')
      })

      it('b', t => {
        t.assert.equal(t.title, 'b')
      })

      it('c', t => {
        t.assert.equal(t.title, 'c')
      })

    })

  })

})

```


# &#9658; Purpose

The purpose of the Suman library is to provide the most sophisticated test runner in the Node.js ecosystem, 
with a better developer experience, better features, higher performance, improved debuggability, 
and more expressiveness than AVA, Mocha, and Tape. 
Suman is a first-rate library and we hope you take the time to compare its capabilities with AVA, Mocha, Tape, TapJS, etc.
One of the more exciting things about Suman is that it can run tests written in any language; all you have to do
is output TAP (Test Anything Protocol).

The primary aims are:

* Developer experience and test debuggability are above ALL else
* Provide a beautiful and intuitive API
* Solve all major and minor problems in the Mocha API, specifically
* Borrow some of the best features from Mocha, AVA and Tape
* Make tests run faster by leveraging concurrency provided by async I/O *and* separate Node.js processes
* _Isolate_ tests by running them in separate processes, so they do not share memory nor interact directly
* Make tests _independent_, so that you can easily run one test at a time (damn you Mocha!).
* Make debugging your test files easier; this is achieved by allowing for the running of tests with the plain-old node executable,
this makes Suman tests "node-able"
* Provide cleaner output, so that developer logging output is not necessarily mixed with test result => 
achieved by using child processes and ignoring stdout.
* Add the missing features from Mocha, Tape and AVA, while simplifying portions of the Mocha API and doing
away with (implicit) global variables.
* Stick closely to the popular Mocha API, so that automatic conversion is possible from Mocha to Suman,
 and that transition is as seamless as possible for the developer - you do *not* have to learn a whole new API!
* Allow for maximum dynamicism so that Suman can match all use cases of users.
* Allow users to create Suman-runnable tests in any languages - this possibility is created by running tests in child processes.
Writing tests in the form of shell scripts is something that almost every project could benefit from and now you can run these 
tests through your universal test runner - Suman!
* Composability - Suman tests should be able to run suman tests as child processes, ad inifitem, without hiccups.


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
* Provide a full-featured, non-dumbed-down API that's easy to get started with, and
both powerful and intuitive to use over the long-run.
* Listen to what the community wants.
* Leverage Javascript's strengths (ahem *closures*)
* Don't be lazy.
* As Suman is a command line application, we can utilize a more functional programming style
* Details matter, and developer experience matters most.


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
       

* <b> Dynamicism </b>
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

## Details matter

    * we designed Suman with details in mind
    * fewer logical branches and contingencies than Mocha WRT rules for hooks
    * much better semantics, with new standard functions alongside Mocha's 'done' callback: 'ctn', 'pass', 'fail' and 'fatal' are new functions
    each with a unique purpose and meaning, and done is still in Suman's API with the same meaning as Mocha!
    * friendly error messages, that also get sent to suman-stderr.log for reference
    * when debugging, (the debug flag is set) timeouts will automatically be set to 'infinity'


## We can say with confidence that Suman is the most powerful test framework for serverside JavaScript on planet Earth
 => as it gives the developer total control and access to a very large set of features, 
 with the explicit goal of being bug-free first, full-featured second.


### More Suman Examples

* See the documentation @ sumanjs.org
* You can also read: https://medium.com/@the1mills/introducing-suman-a-node-js-testing-library-20fdae524cd

### S.L.A.

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

TBD


## Important aside - How is Suman better than AVA?

 It should be abundantly clear why Suman is better than Mocha, but how is Suman better than AVA? 
 (If it's not clear why Suman is better than Mocha then scroll back up).
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
 tremendously!
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
 


![alt text](https://raw.githubusercontent.com/sumanjs/suman-docs/master/images/suman.png "Suman Primary Logo")
