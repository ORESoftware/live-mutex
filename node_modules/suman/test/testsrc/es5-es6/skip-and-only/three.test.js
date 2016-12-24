
/*

This test is to ensure that if only is called on blocks registered towards the end of the current tick,
that they are still the only ones that run.

*/

const suman = require('suman');
const Test = suman.init(module, {
   __expectedExitCode: 95
});


Test.create('SimpleTest', {parallel: false}, function (assert, fs, http, os) {

  assert(false,'this should never run');

  this.it('is great', t => {

  });

});


Test.create.only('Complex test', {parallel: false}, function (assert, fs, http, os) {



  this.it('is great', t => {


  });


});



