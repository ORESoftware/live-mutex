## Concurrency within a single test suite

For the purposes of speed, ideally your test cases can run in parallel/interleave.
However, if they are interleaving, they can both modify data in the shared scope and cause race conditions.
To avoid these types of race conditions, Suman provides features to pass data (hopefully immutable) directly
between test cases and beforeEach/afterEach hooks (in both directions)

Please learn about the purposes of t.data and t.value, the below is an illustration:


```
 // this is very bad!!

var value = 3;

this.beforeEach(t => {
    value++;
});


this.it('is 4', t => {
    assert.equal(value,4);

});

this.it('is 5', t => {
    assert.equal(value,5);
});

```

instead your should do this:


```
    // this is much better

    this.beforeEach(t => {
        t.data.num = ++t.value;
    });


    this.it('is 4', {value: 5}, t => {
        assert.equal(t.data.num, 6);
    });


    this.it('is 5', {value: 8}, t => {
        assert.equal(t.data.num, 9);
    });

```

and even better is this, if you can follow:

```
    // this is even better

    this.beforeEach(t => {
        t.data.num = ++t.value;
    });


    this.it('is six', {value: 5}, t => {
        assert.equal(t.data.num, t.value + 1);
    });


    this.it('is nine', {value: 8}, t => {
        assert.equal(t.data.num, t.value + 1);
    });
    
```

## Transpilation

If you are running an individual test file, and you are in the process of developing or debugging the test, you can and should use
babel-node, which is available with the suman-babel command.

If you are running a group of tests and want to transpile first, then you should turn this into a 
gulp task or makefile task.


## Organization

We highly recommend having all your tests stick to a naming convention

for example, a suman test should always end with ```".test.js"```.

that way, when use Make or Gulp etc, you can use

```TESTS=$(shell find test/ -name "*.test.js")```

in this way, you can distinguish which files to run, and the Suman
runner will never run a non-Suman test file.




