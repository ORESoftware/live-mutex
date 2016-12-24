const suman = require('suman');
const Test = suman.init(module, {});

Test.create.delay(__filename, {}, function (assert, describe) {
  setTimeout(this.resume, 2000);

  describe('A', function (it) {
    it('a', function () {
      console.log('a');
    });
  });
});

Test.create.delay(__filename, {}, function (assert, describe) {
  setTimeout(this.resume, 2000);

  describe('B', function (it) {
    it('b', function () {
      console.log('b');
    });
  });

});

Test.create.delay(__filename, {}, function (assert) {
  setTimeout(this.resume, 2000);

  this.describe('C', function () {
    this.it('c', function () {
      console.log('c');
    });
  });

});
