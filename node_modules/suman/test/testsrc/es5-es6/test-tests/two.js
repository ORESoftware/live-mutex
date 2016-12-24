const suman = require('suman');
const Test = suman.init(module, {});

Test.describe('root suite description', {}, function (assert) {   // we define the root suite

  //note: we are in the context of the "root suite"

  const self = this;    // (avoid the self pattern in Suman tests, here for explanation only :)

  this.before.cb(t => {
    assert(this === self); //true
    t.done();
  });

  this.beforeEach.cb(function (t) {
    assert(this === self); //true
    t.ctn();
  });

  this.it('though this was fixed', function (t) {
    assert(this === self);  //true
    t.log('whooooa');
  });

  this.describe('child suite A', {}, function () {  //calling 'this.describe' creates a child suite

    assert(this.parent.title === 'root suite description'); // true

    const that = this;  //we have a new context, and the new context is this child suite A

    assert(that !== self);  // true

    this.before(function () {
      assert(this === that); //true
    });

    this.beforeEach(() => {
      assert(this === that); //true
    });

    this.it('this test', function () {
      assert(this === that); //true
    });

    this.describe('child suite B', {}, function () {  //calling 'this.describe' creates a child suite

      const ctx = this; //we have a new context, and the new context is this child suite B

      assert(this.parent.title === 'child suite A');  // true
      assert((ctx !== that && ctx !== self));  // true

      this.before(function () {
        assert(this === ctx); //true
      });

      this.beforeEach(function () {
        assert(this === ctx); //true
      });

      this.it('has desc', () => {
        assert(this === ctx); //true
      });

    });

  });

});