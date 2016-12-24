Suman is a test <i>framework</i>, not a library. It gives you strong guidance on how to organization your tests, including naming conventions, test directory organization,
and preventing the use of global variables across tests. However Suman is unopinionated and agnostic when it comes to:

1. assertions
2. spies
3. reporters
4. mocking libraries

Suman provides an extremely powerful and versatile framework designed for maximum code reuse, test isolation,
parallelism with multiple Node.js processes and the best possible developer experience. Suman is designed to make 
tests "nodeable" by allowing any given test to be run with ```node``` itself, which frankly is amazing, 
as well as being highly debuggable with excellent error reporting and useful logging files. 

Suman also has built-in code coverage tooling (using Istanbul), as well as filesystem watchers that can run your test suites every-time you 
make a change to the codebase, or watchers which run a test file everytime you make a change to the test file. Suman provides a simple Express
server which runs in the background and collects/reports test data and watches for filesystem changes.


### Primary features



### Transpilation and usage with Babel:

Suman has first-class support for transpilation with Babel but recommends you avoid transpilation, 
so that your tests remain node-able and are more debuggable. If you like ```async/await``` functionaliy, the Suman docs
will demonstrate how you can achieve the same thing with ES6 generators + Promises. Indeed, ```async/await``` is simply
syntactic sugar over those constructs. Instead of using ```babel-register``` or ```babel-node```, Suman recommends transpiling your
test source to a target directory, so that your test tranpilation process is transparent. Using ```suman.conf.js```, you can tell Suman
which methodology you wish to use.

### Target audience

Suman was written primarily to serve the needs of application developers in the workplace, especially those
who need powerful tools for integration and system testing.

Node.js library authors, writing an NPM package here or an NPM package there, may not need all the features included in Suman, 
and may find that using something as simple as Tape will suit their needs.