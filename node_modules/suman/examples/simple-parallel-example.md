

```js

const suman = require('suman');
const Test = suman.init(module);


Test.describe('@Test1', {parallel: true}, function () {


    this.it('one', t => {
        return promiseTimeout(t);
    });


    this.it('two', t => {
        return promiseTimeout(t);
    });


    this.it('three', t => {
        return promiseTimeout(t);
    });


    this.it('four', (t) => {
        return promiseTimeout(t);
    });


    this.it('five', t => {
        return promiseTimeout(t);
    })
    
    .it('four', (t) => {
          return promiseTimeout(t);
      });
       
     .it('five', t => {
           return promiseTimeout(t);
      });


});
```