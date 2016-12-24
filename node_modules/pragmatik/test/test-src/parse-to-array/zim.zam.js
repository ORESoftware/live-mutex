const suman = require('suman');
const Test = suman.init(module);

Test.create('basic tests', function (pragmatik, assert) {

  const r = pragmatik.signature({

    mode: 'strict', // does not allow two adjacent non-required types to be the same
    allowExtraneousTrailingVars: false,
    args: [
      {
        type: 'string',
        required: false,
      },
      {
        type: 'boolean',
        required: true,
      },
      {
        type: 'object',
        required: true,
      },
      {
        type: 'boolean',
        required: false,
      },
      {
        type: 'function',
        required: false,
      }
    ]
  });

  function foo () {
    return pragmatik.parse(arguments, r);
  }

  this.it('zims and zams (1)', t => {

    const [a,b,c,d,e] = foo(true, { zim: 'zam' }, function () {});
    assert.equal(a, undefined, 'a is not undefined.');
    assert.equal(b, true, 'b is not true, but should be true.');
    assert.deepEqual(c, { zim: 'zam' }, 'c is not the object it is supposed to be.');
    assert.deepEqual(d, undefined, 'd is not undefined.');
    assert.deepEqual(typeof e, 'function', 'e should be a function.');

  });

  this.it('zims and zams (2)', { throws: /Argument is required at argument index = 1, but type was wrong/ }, t => {

    const [a,b,c,d,e] = foo('dog', { zim: 'zam' }, function () {});

  });

  this.it('zims and zams (3)', { throws: /Argument is required at argument index = 2, but type was wrong/ }, t => {

    const [a,b,c,d,e] = foo('dog', false, function () {});

  });

});

