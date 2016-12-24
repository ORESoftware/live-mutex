const suman = require('suman');
const Test = suman.init(module, {
  series: true
});


Test.create.delay(__filename, {}, function (assert) {

  setTimeout(this.resume,2000);

  this.describe('A', function(){
    this.it('a', function(){
      console.log('a');
    });
  });
});

Test.create.delay(__filename, {}, function (assert) {
  setTimeout(this.resume,2000);

  this.describe('B', function(){
    this.it('b', function(){
      console.log('b');
    });
  });

});

Test.create.delay(__filename, {}, function (assert) {

  setTimeout(this.resume,2000);

  this.describe('C', function(){
    this.it('c', function(){
      console.log('c');
    });
  });

});
