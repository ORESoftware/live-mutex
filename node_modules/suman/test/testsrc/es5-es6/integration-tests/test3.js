

const suman = require('suman');
const Test = suman.init(module, {});

Test.describe('My Suite', {}, function (describe, it, assert) {

  console.log('suman runner');

  it('dayum', t => assert(true));

  describe.skip('desc', {}, function () {

  });

  describe.only('desc', {}, function () {

    this.it('whoa', function(){
      console.log('is whoa');
    })

  });

  this.describe('bugs', function () {

    this.it.only('is meow', function (t) {

      throw new Error('jesus christ');

    });

    this.describe('turtles', {}, function () {

      this.beforeEach(function () {

        //throw new Error('michal');

      });

      this.describe('sounds', function () {

        this.it.cb('is good');

      });

    });

  });

});


