

You can use Suman programmatically. This is like test macros.

```js
// test.js

import * as suman from 'suman';
const Test = suman.init(module);

Test.create('example', function(it, args, assert){
 
      // args is [1,2,3]  
    
      it('args is an array', t => {
         assert(Array.isArray(args));
      });
      
});


// other.file.js

import * as suman from 'suman';
const test = suman.load('./test.js');
test.on('test', t => t.apply(null,[1,2,3]));


```


