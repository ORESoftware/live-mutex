

The best patterns to use with Suman to get the most out of the framework.

See the following example projects which will show you how to get the most out the Suman test framework.
Benefits will be maximum code-reuse, speed and isolation from multiple Node.js processes, 
and clean-coding patterns and expressiveness.

>  Project 1
>
>  Project 2
>
>  Project 3



1. Inject dependencies with suman.ioc.js



2. Use the delay functionality to source dependencies asynchronously before registering any given test cases.

```js

Test.describe('A', {}, function(fs, delay){
  
      const $items = null;
  
     fs.readDir('some-unit-test-dir', function(err, items){
               err && throw err;
               $items = items;
               delay(); // all describe blocks have already been registered, and now we execute their respective callbacks
     });
     
     
     this.describe(function(){
     
             this.describe(require('a'));
             this.describe(require('b'));
             
             $items.forEach(item => {
                 this.describe(require(item));
             });
     
     });


});


```

3. If you want to use arrow functions everywhere, then you have to inject the methods for each test block like so:

```js

Test.create('example', function(describe){
    
    describe('one', (describe, it) => {
        
        it('has legs 1', t => {
            
        });
        
        describe('two', (it) => {
           it('has legs 2', t => {
                        
            });
        });
        
        
        describe('three', (it) =>{
           it('has legs 3', t => {
                  
               
           });
            
        });
        
    });
    
});


```
