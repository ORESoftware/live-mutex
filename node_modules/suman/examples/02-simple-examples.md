Here is the simple examples page.

```

const suman = require('suman');
const Test = suman.init(module, {});


Test.describe(__filename, function (assert) {

    this.before(t => {
        console.log('before');
    });

    this.it(t => {
        assert(true);
    });


    this.after(t => {
        console.log('after');
    });

});


```

=> run the file with ```$ node your/test/file.js``` and notice the logging output.

=> next, try running the with ```$ suman your/test/file.js```, the output should be pretty much the same as above.

=> now, try running the above with ```$ suman --runner your/test/file.js```, now we are running the test in a child_process. Normally
we would only use the runner when running multiple test files, but we can tell suman to use the runner even when executing one test file
with the "--runner" flag.

Notice that "assert" is passed into the top-level describe block callback => this of course is the core assert module, which gets injected into
our test suite by the Suman framework. Core module names are reserved and require no configuration.


Now let's try:


```
const suman = require('suman');
const Test = suman.init(module, {});


Test.describe(__filename, function (assert, child_process) {

    this.before(t => {
        console.log('before');
    });

    this.it(t => {
        assert(true);
    });


    this.it(t => {
        assert(true);
    });


    this.describe('nested describe block', function () {


        this.beforeEach(t => {
            console.log('beforeEach hook should only run once');
        });


        this.it(t => {
            assert(true);
        });

    });


    this.after(t => {

        console.log('after');

    });

});

```


