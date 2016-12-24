

## Dependency Injection with Suman


For any block (test suite block), you can source/inject dependencies by name.

There are three types of dependencies that can be injected, in order of precedence.

1. Node.js core modules.
2. Suman library methods (describe, before, beforeEach, after, afterEach, it, etc).
3. Values and dependencies referenced in your suman.ioc.js file (very useful).


## A quick explanation of each of the above:


As for 1, try this:

```js

const suman = require('suman');
const Test = suman.init(module);

Test.create('example', function(assert, fs, http, child_process){

    // the core modules are injected here, because Suman reserves them
    // any ink lost in initialization suman has already been gained back
 
});


// and just FYI, you can even do this, if you want:

const suman = require('suman');
const Test = suman.init(module);

Test.create('example', function(assert, fs){

      this.describe('inner', function(http){
      
         // http module is injected and can only be referenced in this block
      
      });
      
      
      this.describe('inner', function(child_process){
      
        // child_process module is injected and can only be referenced in this block
      
      })
    
 
});



```

As for 2, this is quite intuitive:


```js

const suman = require('suman');
const Test = suman.init(module);

Test.create('example', function(before, describe){

    before(t => {
    
    });
    
    
    describe('inner', function(it){
    
       it('makes testing fun', t => {
       
       });
    
    });
    
     describe('inner', function(beforeEach, it){
     
          beforeEach(t => {
          
          
          });
        
          it('makes testing fun', t => {
                   
          });
        
        
        });
 
});
```


As for 3, please see the section on how to use suman.ioc.js.

