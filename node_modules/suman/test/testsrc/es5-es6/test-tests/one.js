const suman = require('suman');
const Test = suman.init(module, {});

Test.describe('root suite description', {}, function () {   // we define the root suite

  //note: we are in the context of the "root suite"

  const self = this;    // (avoid the self pattern in Suman tests, here for explanation only :)

  this.before(() => {
    console.log('1', this === self); //true
  });

  this.beforeEach(function () {
    console.log('2', this === self); //true
  });

  this.it('geee whiz', function () {
    console.log('3', this === self);  //true
  });

  this.describe('child suite A', {}, function () {  //calling 'this.describe' creates a child suite

    console.log('4', this.parent.title === 'root suite description'); // true

    const that = this;  //we have a new context, and the new context is this child suite A

    console.log('5', that !== self);  // true

    this.before(function () {
      console.log('6', this === that); //true
    });

    this.beforeEach(() => {
      console.log('7', this === that); //true
    });

    this.it('jones', function () {
      console.log('8', this === that); //true
    });

    this.describe('child suite B', {}, function () {  //calling 'this.describe' creates a child suite

      const ctx = this; //we have a new context, and the new context is this child suite B

      console.log('9', this.parent.title === 'child suite A');  // true
      console.log('10', (ctx !== that && ctx !== self));  // true

      this.before(function () {
        console.log('11', this === ctx); //true
      });

      this.beforeEach(function () {
        console.log('12', this === ctx); //true
      });

      this.it('makes party',t => {
        console.log('13', this === ctx); //true
      });

    });

  });

});