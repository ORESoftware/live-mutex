The following features are currently in the works, mostly planned for a 2.0.0 version of Suman:


1. Provide a web interface to see test results over time. That means we will store test results in SQLite, and use Suman
Server to deliver test results to the browser. This feature was started but not completed yet. Ideally, only
one instance of Suman Server will run on any machine. Suman Server will be responsible for both file watching as well
as delivering the web page locally.

2. Add more fun reporters. The 2 reporters Suman currently has are utilitarian and verbose. We will add 
some more reporters as we go. You can always create your own, see:


3. Support other languages besides JS. The 1.x version of Suman will use Node.js standard IPC to communicate with child processes. 
This very much limits Suman to only using JavaScript/Node.js for running tests. Even though there will never
be first-class support for this, we'd like to allow users to write tests in Golang, Python, Java, etc, and also the browser! 
Users can use the Suman runner to run tests in any language, as long as the other processes can communicate effectively
with the Suman API, most likely using Websockets.

In order to communicate with processes running in another language, we will most likely have to use Websockets for IPC, 
not the UNIX socketpair approach that Node.js uses out of the box. In order to support running tests in other languages, 
Suman will have to rely heavily on the community to develop test runners that adhere to the Suman runner API. Basically,
the test file in Python, Golang, Java, etc, can be in any format, but they will need
to implement Websockets and communicate with the Suman test runner.
    

4. Support observables. As this area of Node and JS congeals, Suman will make observables a first-class citizen
 alongside promises and callbacks, event-emitters, etc.
    
    
5. Improve grouping of tests, so that test groups can easily run on multiple machines.
Right now, Suman is *not* designed to run different Suman groups on different machines. 
Suman groups will basically override any behavior given by suman.order.js.

    
6. Optimize suman.order.js => Optimize the order in which tests run, according to
suman.order.js; also, allow for better randomization of test order.


