const suman = require('suman');
const Test = suman.init(module);


Test.create.only('SimpleTest', {parallel: false}, function (assert, fs, http, os) {


  this.it('is great', t => {

  });

});


Test.describe('Complex test', {parallel: false}, function (assert, fs, http, os) {

  assert(false,'this should never run');

  this.it('is great', t => {

  });


});



