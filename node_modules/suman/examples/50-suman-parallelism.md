This is an area where Suman really shines and has a lot of advantages over AVA etc.

I want to start with a super awesome example of how Suman rocks the party; personally I like to start with
a concrete example before speaking on generic or abstract terms, I learn better that way.


So here is the skeleton of our example test suite (copy it and run it).

```js
const suman = require('suman');
const Test = suman.init(module, {});

//remember, we can use arrow functions everywhere except describes, since describes are responsible for
//creating a new context and binding it to the callback. 


Test.describe('Zulu', {parallel: false}, function () {  //root suite is *not* parallel (aka series)


    this.describe('A', {parallel: true}, function () { 

    });


    this.describe('B', {parallel: true}, function () {

    });


    this.describe('C', {parallel: true}, function () {

    });


    this.describe('D', {parallel: true}, function () {

    });


});
```


You can see the pattern right? We have 4 child suites which are declared parallel and the 1 parent suite (the root suite)
 is declared  as being "series" because {parallel:false} for a parent will mean the child suites all run in series.


So now, let's flesh it out:


```js
const suman = require('suman');
const Test = suman.init(module, {});


Test.describe('Zulu', {parallel: false}, function () {  //parent is series (parallel:false)

    this.describe('A', {parallel: true}, function () {

        this.it(this.desc + '1', t => {
            setTimeout(function () {
                t.done();
            }, 800);
        });

        this.it(this.desc + '2', t => {
            setTimeout(function () {
                t.done();
            }, 800);
        });

    });


    this.describe('B', {parallel: true}, function () {

        this.it(this.desc + '1', t => {
            setTimeout(function () {
                t.done();
            }, 500);
        });

        this.it(this.desc + '2', t => {
            setTimeout(function () {
                t.done();
            }, 500);
        });

    });


    this.describe('C', {parallel: true}, function () {


        this.it(this.desc + '1', t => {
            setTimeout(function () {
                t.done();
            }, 300);
        });

        this.it(this.desc + '2', t => {
            setTimeout(function () {
                t.done();
            }, 300);
        });

    });


    this.describe('D', {parallel: true}, function () {


        this.it(this.desc + '1', t => {
            setTimeout(function () {
                t.done();
            }, 100);
        });

        this.it(this.desc + '2', t => {
            setTimeout(function () {
                t.done();
            }, 100);
        });

    });

});
```

As you can see above, each child suite's test cases ran in parallel, but the 4 child suites were actually run 
series. If they were run in parallel, then we would expect D's test cases to finish first. And now we flip the switch,
and we can see that D's test cases do in fact finish first, if we make the parent parallel:



```js
const suman = require('suman');
const Test = suman.init(module, {});

Test.describe('Zulu', {parallel: true}, function () {   //now we make the parent parallel


    this.describe('A', {parallel: true}, function () {

        this.it(this.desc + '1', t => {
            setTimeout(function () {
               t.done();
            }, 800);
        });

        this.it(this.desc + '2', t => {
            setTimeout(function () {
                t.done();
            }, 800);
        });

    });


    this.describe('B', {parallel: true}, function () {

        this.it(this.desc + '1', t => {
            setTimeout(function () {
                t.done();
            }, 500);
        });

        this.it(this.desc + '2', t => {
            setTimeout(function () {
                t.done();
            }, 500);
        });

    });


    this.describe('C', {parallel: true}, function () {


        this.it(this.desc + '1', t => {
            setTimeout(function () {
                t.done();
            }, 300);
        });

        this.it(this.desc + '2', t => {
            setTimeout(function () {
                t.done();
            }, 300);
        });

    });


    this.describe('D', {parallel: true}, function () {


        this.it(this.desc + '1', t => {
            setTimeout(function () {
                t.done();
            }, 100);
        });

        this.it(this.desc + '2', t => {
            setTimeout(function () {
                t.done();
            }, 100);
        });

    });

});
```

See the difference in the output? Play with this example and you will see the pattern.

The pattern is explained below.


So, what are the rules for how the parallel option works in Suman?
There are two places in Suman tests where we can choose something to run in parallel or in series.

Those two places are:


1. ```Test.describe/this.describe('Foo', {parallel:false}, function(){});```

2. ```this.it('foo', {parallel:true}, function(){});```


(What about hooks? beforeEach/afterEach hooks run in series for a single test case, but in parallel across test cases; before/after hooks always run in series.) 

Here are the rules above how these operate. 
Let's start with case 2. For "it" test case functions, if "it" is declared as parallel, it will run in parallel with any other test case that is also declared parallel. 
It's that simple for it test cases

In the case of 1, for describes, declaring the describe block as parallel has two different effects.

1. It switches the default for of any of the test cases that directly belong to that describe block.
Normally, to declare a test case as parallel we have to use {parallel:true}. However, if the containing describe suite
is declared parallel, then by default all the of the test cases will be run in parallel, unless they  explicitly use
parallel:false.

Here is an example:

```js
Test.describe('A', function(){

   this.describe('B', function(){
   
          //we stub the test cases out just for brevity's sake
          this.it('a');  //runs in series
          this.it('b');  //runs in series
          this.it('c');  //runs in series
   
   });

});

Test.describe('A', function(){

   this.describe('B', {parallel: true}, function(){
   
          //now, because the containing describe suite is declared parallel, all test cases default to parallel,
          //which can be convenient if you don't want to have to add {parallel: true} to each test case
          
          this.it('a');  //runs in parallel with other test cases
          this.it('b'); //runs in parallel with other test cases
          this.it('c'); //runs in parallel with other test cases
   
   });

});

and of course, to complete the picture, we can

Test.describe('A', function(){

   this.describe('B', {parallel: true}, function(){
   
          //now, because the containing describe suite is declared parallel, all test cases default to parallel,
          //which can be convenient if you don't want to have to add {parallel: true} to each test case
          
          this.it('a');  //runs in parallel with other test cases
          this.it('b', {parallel:false}); //runs first, then the other two tests run in parallel
          this.it('c'); //runs in parallel with other test cases
   
   });

});
```

Now, let's get really nasty, let's do some more nesting to see what happens. To be continued.
