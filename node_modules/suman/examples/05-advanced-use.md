
Suman provides powerful features that are not available in any other Node.js test runner including AVA. 

   * Suman groups allow you run groups of tests in separate containers
   * Using the Suman executable gives you pre/post hooks that run before your test suite executes

The files in the suman folder in your project allow you to really boost the power of your testing system.


[1.] **```suman.once.js```** 

User defined hooks, which will only run once when they are listed as 
"integrants" in any suman suite. The best use case for these hooks is to check that certain network
components are live before running a test. If the service is not available, suman will report this and abort the tests
early, allowing you better information about which component(s) might not be live.


[2.] **```suman.ioc.js```** 

Dependency injection in the root suite of any test is controlled by you, when you edit the suman.ioc.js file. In the suman.ioc.js file you see some examples,
showing you how to inject values into a test suite. There are several advantages to this. One, you save some ink in each
test suite. If several tests in your project need the same resource, this resource can be initialized and procured in
suman.ioc.js, instead of initializing repetively in multiple tests, or using globals (which won't work for asynchronously sourced dependencies either). This is especially useful for resources that need to be
initialized/loaded asynchronously. The simplest example is database values that you might use in multiple tests.

[3.] **```suman.order.js```**

This file provides constraints for the test runner. Unbridled, the test runner may run 1000+ tests in separate processes at the same time. You should use suman.order.js to control which processes block each other.
The simplest way to cap the number of tests running at the same time is to use the --concurrency option at the command line or the maxParallelProcesses option in the config. They
do the same thing, despite the different names. The reason is because **maxParallelProcesses** is more descriptive, but simply too long for a command line option.

[4.] **```suman.hooks.js```**

Write standard code in this file that will add suites and/or hooks to every test


[5.] **```suman.globals.js```**

If you would like to use any global variables in any or all your tests, you should initialize them here. However, this is not recommended.
Suman will load these globals before running any test, as would be expected; however, when using the plain node executable, you will then need to use
the --require node option to load the suman.globals.js file, so that this loads before you test runs. This may make things more difficult then it's worth, and instead of using suman.globals.js, 
we recommend using suman.ioc.js to inject the values you wish to use instead of making the values global, for the above reason.



 <div>
        <img src="images/suman_run_with_runner.svg" width="100%">
    </div>




