There are several anti-patterns when using Suman:


[1.] **Anti-pattern number 1.** self/that. I am personally a fan of self/that usage. However, when using Suman, it is indeed an anti-pattern. If you notice that you
have used "self" or "that" instead of "this" to call something from the Suman API, then you should write your code to avoid the self pattern when using Suman. With arrow functions, you can
avoid the self/that pattern, when using functional loops for example. The reason to avoid self/that is that a reference to self/that might show up in a nested describe block and then
you may start registering test cases and hooks to the wrong block. 

You should always endeavor to use "this" when calling this.describe/this.before/this.after etc, and you will be all good.

[2.] **Anti-pattern number 2.** Putting code outside of and above ```Test.describe``` (the call that creates the root suite). As much code of your test code as possible should be inside the Test.describe callback.
There are several reasons to do this. It makes it a bit easier to see the title of your suite. More importantly, the more setup code before 
a Test.describe/Test.suite call, the less code sharing you have => If you have a lot of code above your Test.describe call, it probably means you aren't using the 
Suman helper files effectively or correctly, (suman.ioc.js, suman.order.js, suman.hooks.js, etc).

[3.] **Anti-pattern number 3.** Using arrow functions, generator functions, or async/await for describe/suite blocks. Describe blocks are only designed to register callbacks synchronously.
Arrow functions are useful for Suman, and they can be used everywhere except for describe blocks. This has to do with arrow functions binding the context for the callback to the wrong value. Describe blocks are designed to bind the callback to a new value (not the context of the current lexical scope), and to register
all API calls synchronously. Suman is designed to throw an exception if any library call is made after a describe block function has returned.

> in other words don't do this:

```

    Test.describe('root test suite', => {
    
    
     });
     
    
```

> or this:


```

    Test.describe('root test suite', => {
    
        this.describe('uses generator function inappropriately', function *{
        
        
        });
    
    
     });
     
    
```

The reason why arrow functions are not permitted is because we need to bind to a new context in the callback. 
Generator functions simply make no sense because the callback is supposed to run synchronously, even though it may be originally
fired asynchronously. 

[4.] **Anti-pattern number 4.** Nesting hooks and test cases. Describe blocks (aka child suites) are supposed to be nested! But hooks and test cases are not designed to be nested.
Suman will throw an error if you try to do it, whereas Mocha would let you errantly do it; see this issue:
https://github.com/mochajs/mocha/issues/1975, LOL, sorry Tom, wasn't me.

in other words, don't do this:

```
 this.it('outer', t => {
  
     this.it('inner', t => {  // Suman will throw an error if you try to nest a test case within a test case
     
      });
 
 });
 ```
 
 or this:
 
 ```
 this.before('outer', t => {
  
    this.beforeEach('outer', t => {   // Suman will throw an error if you try to nest a hook within a hook
  
  
     });
   
    this.it('inner', t => {     // Suman will throw an error if you try to nest a test case in a hook, or a hook in a test case
      
    });
  
  });
  ```

note that anti-pattern number 4 relates directly to anti-pattern number 7

[5.] **Anti-pattern number 5.** Unnessarily using process.nextTick or setImmediate in hook / test callbacks

```js

// it is not necessary to do this
this.it('not necesary', t => {

       var c;
      if(c = condition()){
          c.doSomethingAsync().then(function(val){
               t.done(null,val)
          });
      }
      else{
        process.nextTick(t);   // no need to wrap in nextTick call
      }

});

// this is better
this.it('not necesary', t => {
      var c;
           if(c = condition()){
               c.doSomethingAsync().then(function(val){
                    t.done(null,val)
               });
           }
      else{
        t.done();   // calling t.done in the same tick is just fine, because Suman will ensure it is async behind the scenes
      }

});
```


[6.] **Anti-pattern number 6.** Perhaps the most important anti-pattern to grok.

You must use t.data and t.value to pass data between beforeEach and afterEach hooks and test cases!


[7.] **Anti-pattern number 7.**  Don't register Test.describe() / Test.suite callbacks asynchronous.

For example, this will throww an error and Suman will exit prematurely =>

```

const suman = require('suman');
const Test = suman.init(module, {
    pre: ['make-a-bet'],
    post: ['destroyAllPools']
});


Test.describe('@TestsPoolio1', {parallel: true}, function (suite, path, async, assert) {


    this.it.cb(t => {
        setTimeout(t, 1000);
    });

});

process.nextTick(function(){
    
    //we register this block asynchronously
    
    Test.describe('@TestsPoolio2', {parallel: true}, function (suite, path, async, assert) {

        this.it.cb(t => {
            setTimeout(t, 1000);
        });


    });

});

```

[8.]  Failing to return a Promise-returning asynchronous function. When not using callback mode, 
the test/hook callback function can act as a Promise provider. If nothing is returned, the test will finish without
being able to properly process any asynchronous behavior.


This following is simply incorrect, the test case will finish in the same tick and we won't be able to capture the Promise

```

this.it('throws error', t => {
    
     asyncFn().then(function(){
    
        throw new Error('now this error gets captured correctly');
    
    });


});

```

This is correct, you must return the Promise in the test case or hook callback

```

this.it('throws error', t => {
    
     return asyncFn().then(function(){    // return the Promise
    
        throw new Error('now this error gets captured correctly');
    
    });

});

```


[9.] Suman anti-pattern number 9.  Putting delay functions inside before hooks.

It makes sense at first, but you must remember that the delay/resume functionality is completely different than the before/after hook functionality.
before/after hook are related to running before and after test cases.

On the other hand, delay/resume have to do with describe blocks, and delaying the running of their respective callback functions.


As an example, if you only call the delay function from inside the before hook, the delay function will never ever get called,
and a timeout will occur:


```
const suman = require('suman');
const Test = suman.init(module, {});


Test.describe('@TestsPoolio1', {parallel: true}, function (suite, path, async, assert, delay) {


    this.before(t => {
        console.log('before');   // we will never get here
        delay();                 // this will never get called
    });

    this.it(t => {
        console.log('test case that will never be invoked, 
        because all describe blocks have to run first before hooks and test cases run')
    });


    this.describe('this block will never be invoked',function () {

        // this block will never be invoked, because delay is not called because it is inside the before hook
        // which will never get called until we register all describe blocks

        console.log('describe');

        this.it.cb(t => {
            console.log('in test case');
            setTimeout(t, 1000);
        });

    });

});
```

instead, this is the right thing to do:


```
const suman = require('suman');
const Test = suman.init(module, {});


Test.describe('@TestsPoolio1', {parallel: true}, function (suite, path, async, assert, delay) {


    //delay will be invoked after 3 seconds, then the nested describe block callback will be fired
    setTimeout(delay,3000); 



    this.before(t => {
        console.log('before');                  
    });

    this.it('one',t => {
      
    });


    this.describe('this block will now be invoked',function () {
    
      // by delaying this callback from firing, we can register a dynamic number of test cases, 
      // and even a dynamic number of hooks

        console.log('describe');

        this.it.cb('two', t => {
            setTimeout(t, 1000);
        });

    });

});

```

[10.] adding unnessary custom timeouts => use the internal timeout val!


// this is unnecessary:

```
    this.beforeEach.cb('create crucible server', t => {
    
      setTimeout(t.fatal, 6000);   // you don't need this, the library has this built-in

      const nodeEnv = t.value.NODE_ENV;

      const port = t.data.port = nextPort();

      const server = t.data.server = child_process.spawn('node', [projectRoot], {
        env: Object.assign({}, process.env, {
          NODE_ENV: nodeEnv,
          port: port
        })
      });

      server.stdout.on('data', function onData(d) {
        if (String(d).match(/listening/)) {
          server.stdout.removeListener('data', onData);
          cb(null);
        }
      });

      server.once('error', t.fatal);

    });
    
```

instead, do this:

```

    this.beforeEach.cb('create crucible server', {timeout: 6000}, t => {

      const nodeEnv = t.value.NODE_ENV;

      const port = t.data.port = nextPort();

      const server = t.data.server = child_process.spawn('node', [projectRoot], {
        env: Object.assign({}, process.env, {
          NODE_ENV: nodeEnv,
          port: port
        })
      });

      server.stdout.on('data', function onData(d) {
        if (String(d).match(/listening/)) {
          server.stdout.removeListener('data', onData);
          cb(null);
        }
      });

      server.once('error', t.fatal);

    });
    
```
    