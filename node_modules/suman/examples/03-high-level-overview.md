

Suman was designed to greatly improve Mocha. It uses the same pattern of nested describe blocks ("suite-blocks" in Suman parlance), as this is a good pattern
allowing for fine-grain control of different sections of the same test suite - something which Tape and AVA probably will always lack.
Nested describes/suites allow us to organize our tests, create separate scopes as well as having different options/settings for each scope, and running different hooks in each block. 
Having these nested blocks is something that Tape and AVA will surely and sorely miss.

For those who are familiar with Mocha and Jasmine, the most apparent difference between Suman and the former are the fact that there are no 
globally defined functions and that 'this' is used to access the Suman API once you are within the root suite of a Suman test.
Using 'this' for the API makes sense, for a few reasons.

1. 'this' cannot be reassigned
2. 'this' appears 'for free' and stays out of sight if you don't need it.
3.  We already need some context for the callbacks, so we might as well use that same context to access the API, and with that, simplify the entire API


Suman simplifies the way contexts are bound; in Mocha, contexts were genuinely confusing, even to those who used Mocha for a long time. 
The number of "hidden" contexts in a Suman test suite is exactly equal to the number of describe statements. By hidden contexts,
we mean the context binding that takes place behind the scenes in the internal Suman API. 
Note that Suman does face the same problem with Mocha with regard to binding new contexts to describe blocks: 
You cannot use arrow functions, generators and async functions with describe callbacks. You can use these anywhere you want using Suman,
*except* you must use traditional functions for describe hooks. The reason, as you probably already know, is that Suman binds a new context to the describe hooks,
and as aforementioned, this is the only instance where a new context is created using Suman, that the user must interact with.

<br>
<br>

##  Suman uses a simple pattern to determine if a test or hook needs a callback function to fire in order to continue 

####  Suman borrows this pattern from AVA, and we belive it's a better pattern than the one that Mocha uses.

##### The question - is .cb() called?

<b> Yes? </b> Then the return value is ignored and we wait for a callback to fire (done,fail,pass,ctn,fatal) are the five available callbacks functions
in Suman and each has a purpose. {done, fail, pass} are availble in tests hooks. {done, ctn, fatal} are available in
before/after/beforeEach/afterEach hooks. If you are really smart you may have a guess as to what they do.*

<b>No?  </b> If no callback function is named, Promise.resolve() is called on the return value for every hook in Suman, including tests.
This goes for generator functions, async/await and functions that of course just return a Promise, without using generators or async/await.


That's pretty much it! What it means actually, is that all tests in Suman are effectively async. Even if you were to do this:

```js
this.it.cb('callback immediately', t => {

       t.done();
       
});
```

internally, process.nextTick() is called after done is fired, so that things end up remainging async. This keeps the internals of the library
running smoothly and predictably.

likewise if you do this:

```js
this.it.cb('callback immediately', t => {

       return 'bunnies';
       
});
```

```Promise.resolve('bunnies').then()``` is what is going to end up happening, so this is async also.


With Mocha and Jasmine if your callback function had done as a parameter, these test frameworks would know to wait 
for that callback for fire before a test case or hook was finished. With Suman, you tell the library that you want to wait for a callback to fire by registering the 
.cb() function. The AVA/Suman pattern allows us to simplify the API by always having a singular param (t) for all hooks and test cases. 

First we will talk about how basic callback arguments, like done, allow us to run test cases and hooks asynchronously. Along with standard callbacks,
Suman handles returned Promises, generators.


<u><b>Mocha</b></u>

```js
before(function(done){

// no matter what happens, until done is called, we cannot continue

});
```

<u><b>Suman</b></u><br>
We use the same pattern, and now have additional callback options, for use with Promises, event emitters

```js
this.before.cb(t => {

// if we call t.done(), it's the exact same as Mocha's done()
// the t.ctn function, short for "continue", is exactly like done, except it's not an error-first callback, which is useful 
// for fulfilled/resolved promises, event emitters, and other non-error first callbacks 
// calling t.fatal() will bail on the overall test suite, no matter what arguments are passed to it, so this is a programmatic way to bail
// if any of t.done, t.ctn, or t.fatal or called, the hook is exited

});
```

### example

```js
this.beforeEach.cb(t => {

 fs.createReadStream('/dev/null').pipe(fs.createWriteStream('/dev/null'))
                                                .on('finish',t.ctn).on('error', t.fatal);

});
```
 
This keeps our code flat, and for anyone coding Node long enough, knows that these extra functions
along with done will be convenient.

However, we don't need to use callbacks exclusively anymore for asynchronous code.
Promises, generators, streams/event emitters, and ES7 async functions allow us alternatives.
Observables will supported in a coming version of Suman.

In Suman, just like Mocha, all test cases and hooks are actually operated on asynchronously, and this is because
```Promise.resolve()``` is called on the return value of every callback.

```Promise.resolve()``` is used to resolve hooks that return Promises, or hooks that are generators or async functions.

Hooks that utilize streams and event emitters will probably need to use traditional callbacks. It is best to keep code
explicit in some cases. See the fs.createReadStream/fs.createWriteStream example above to see how callbacks can be used
with streams (all streams are event emitters). If you use Gulp, you can return streams from tasks, and Gulp knows how to handle that,
so that you don't need callbacks. One improvement Suman might make later on is to handle streams more automatically (without callbacks), at least 
if they are fs-style streams. But for now, you don't have to return the stream, and you will need to use callbacks so that the hook
will wait for it to complete.



### What about test cases?


Mocha

```js

it('test case', function(done){  
    
     
 
});
```

<u><b>Suman</b></u><br>
Just like with hooks, test cases have some more callbacks available to them; you don't have to use them all,
but they are available to be injected in the callback if you name them.

```js

this.it.cb('test case', t => {  

 // t.done is exact same as Mocha's done
 // t.pass is analogous with the t.ctn function in hooks, it is a non-error-first callback
 // t.fail is a function that will fail your test no matter what the t.fail function is passed
 // only one function needs to be called to exit the test case, as would be expected

});
```

### example with Promises


```js

this.it('test case', t => {    // we don't need any callbacks, and Suman handles thrown errors inside Promises properly

 return doSomethingAysnc().then(function(val){
      assert(typeof val === 'object');
 });

});
```


### examples with Streams/EventEmitters

```js

this.it.cb('test case', t => {    

  new MyEventEmitter(t.data).startDoingBusiness().on('error',t.fail).on('success',t.pass);

});
```





