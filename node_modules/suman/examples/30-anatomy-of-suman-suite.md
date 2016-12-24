

This article goes into intricate detail about the "hidden" contexts in different scopes of a Suman test 


```js

//we have our root suite, followed by a nested child suite A, that in turn has a nested child suite B
//if you run this example, and look at the logs, you will get a feel for how a Suman test is executed


const suman = require('suman');
const Test = suman.init(module, {});

Test.describe('root suite description', {}, function () {   // we define the root suite


    //note: we are in the context of the "root suite"

    const self = this;    // (avoid the self pattern in Suman tests, here for explanation only :)


    this.before(t => {
        console.log('1', this === self); //true (has to be, due to arrow functions)
    });

    this.beforeEach(function (t) {
        console.log('2', this === self); //true
    });

    this.it(function (t) {
        console.log('3', this === self);  //true
    });


    this.describe('child suite A', {}, function () {  //calling 'this.describe' creates a child suite

        console.log('4', this.parent.title === 'root suite description'); // true

        const that = this;  //we have a new context, and the new context pertains to child suite A

        console.log('5', that !== self);  // true

        this.before(function (t) {
            console.log('6', this === that); //true
        });

        this.beforeEach(t => {
            console.log('7', this === that); //true
        });

        this.it(function (t) {
            console.log('8', this === that); //true
        });


        this.describe('child suite B', {}, function () {  //calling 'this.describe' creates a child suite

            const ctx = this; //we have a new context, and the new context pertains to child suite B

            console.log('9', this.parent.title === 'child suite A');  // true
            
            console.log('10', (ctx !== that && ctx !== self));  // true

            this.before(function (t) {
                console.log('11', this === ctx); //true
            });

            this.beforeEach(function (t) {
                console.log('12', this === ctx); //true
            });

            this.it(t => {
                console.log('13', this === ctx); //true
            });

        });

    });

});
```

in test form that would look like!


```js

Test.describe('root suite description', {}, function(assert){   //root suite

    
    //we are in the context of the root suite
    
    const self = this;    // (avoid the self pattern in Suman tests, here for explanation only :)
   
    
    this.before(function(){
    
         assert(this === self); //true
    
    });
    
    this.beforeEach(function(){
    
          assert(this === self); //true
         
    });
    
    
    this.describe('child suite A', {}, function(){
  
          assert(this.parent.title === 'root suite description'); // true
          
          const that = this;  // that !== self // true;   
           
  
        this.describe('child suite B', {}, function(){
           
             assert(this.parent.title === 'child suite A');  // true
           
           
         });
  
  });

});
```