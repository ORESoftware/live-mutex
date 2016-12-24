

Suman has some hidden/secret features that will be helpful to know about


Did you know that in callback mode, t is a function?

```js
this.it.cb('whoa', t => {

     assert.equal(typeof t,'function'); // true
     assert(t instanceof Function);     // true

});

```

the reason for this is to support direct/automatic conversion from Mocha, so that you can still do things like:

```

function helper(cb){
    
      if(!condition){
        cb(new Error('data is not defined');
      }
      else{
      ... do something else
      }

});



this.it('whoa', helper);



```

or more complexly:


```js

function helper(data, cb){
    
      if(!data){
        cb(new Error('data is not defined');
      }
      else{
      ... do something with data
      }

});



this.it('whoa', helper.bind(this, 'some data'));


```

or if you think .bind() is ugly and inexplicit like me, do it like so:

```js

function makeHelper(data){

 return function helper(cb){
    
      if(!data){
        cb(new Error('data is not defined');
      }
      else{
      ... do something with data
      }

   });

}


this.it('whoa', makeHelper(data));


```

as you can see ```helper.bind(null, 'some data')``` returns a new function that simple takes one argument => an error-first callback.
and it turns out that t is simply an error-first callback!




## Did you know, you can run all your tests in a single Node.js process <i> if you want </i>.

use ```export SUMAN_SINGLE_PROCESS=yes```


## Did you know, you can force Suman to make everything run in parallel or series with these environment variables?

```
export SUMAN_FORCE_SERIES=yes
export SUMAN_FORCE_PARALLEL=yes
```

what these do is make all hooks and test cases run in series, or parallel, without you having to change your code. If your
code runs cleanly in parallel, that is a good sign.


## Did you know that you can give Suman an expected exit code, if you expect a test process to exit with an exit code other than 0?

