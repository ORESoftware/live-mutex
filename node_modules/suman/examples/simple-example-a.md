

## usage examples

simple example:

```js

const suman = require('suman');
const Test = suman.init(module);

Test.describe('FirstExample', function(assert, path, http){     //  this is our test suite, and we inject some core modules


     this.beforeEach('runs before every it()', t => {
         t.data.foo = 'bar';
     });


     this.it('uno', t => {     // a test case
     
        assert(t.data,'This will pass because t.data is predefined by Suman for each test');  
     
     }).it('dos', t => {       // a test case, (you can chain test cases and hooks if you want to) 
     
        assert(false,'not good');  
     
     }).it('tres', t => {       // a test case 
         return new Promise(function(resolve,reject){               
                 resolve(null);  
           });
     });
     
     
     this.describe('all tests herein will run in parallel', {parallel:true}, function(){
     
          [1,2,3].forEach(item => {
               this.it('item is a number', () => {
                    assert.equal(typeof item,'number');
               });
          });
          
          
          ['a','b','c'].forEach(item => {
                    
               this.it('now we use asynchrony', (t,done) => {
                    setTimeout(function(){
                        done(new Error('Test failed'));
                    }, 2000);
                });
                 
           });
     
     });

});


```
