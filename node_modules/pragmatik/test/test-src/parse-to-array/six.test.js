const suman = require('suman');
const Test = suman.init(module);

Test.describe('basic tests', {}, function (pragmatik, assert, util) {

  const r = pragmatik.signature({

    mode: 'strict', // does not allow two adjacent non-required types to be the same
    allowExtraneousTrailingVars: false,
    args: [
      {
        type: 'string',
        required: false,
        checks: [
          function (val) {  //check to see if the object has a certain constructor or what not
            assert(val);
          }
        ]
      },

      {
        type: 'object',
        required: false,
        checks: [
          function (val) {
            assert('m' in val, 'property "m" not present.');
          },
        ]
      },
      {
        type: 'function',
        required: false
      },
    ]
  });

  function foo () {
    return pragmatik.parse(arguments, r);
  }

  function compoundFoo () {
    return pragmatik.parse(foo.apply(null, arguments), r);
  }

  function tripleFoo () {
    return pragmatik.parse(compoundFoo.apply(null, arguments), r);
  }

  function quadrupleFoo () {
    return pragmatik.parse(tripleFoo.apply(null, arguments), r);
  }

  this.it('basic #1', t => {

    const args = [ undefined, { m: 'hi' }, function () {} ];

    const vals = [
      foo.apply(null, args),
      compoundFoo.apply(null, args),
      tripleFoo.apply(null, args),
      quadrupleFoo.apply(null, args)
    ];

    vals.forEach(function (v) {
      const [a,b,c,d] = v;
      assert(a === undefined, 'a should be undefined');
      assert.equal(typeof b, 'object', 'b should be an object');
      assert.equal(typeof c, 'function', 'c should be a function');
      assert(d === undefined, 'd should be undefined');

    });

  });

  this.it('basic #1', t => {

    const [a,b,c,d] = foo('',{ m: 'dog' }, function () {

    });

  });

  this.it('basic #1', t => {

    const [a,b,c,d] = foo({ m: 'dog' }, function () {

    });

  });

});

