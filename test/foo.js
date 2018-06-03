const suman = require('suman');

const Test = suman.init(module);

Test.create(b => {

  const {describe, before} = b.getHooks();

  before(h => {
    h.supply.foo = 5;
    h.set('my foo', 6);
  });

  describe('inner', b => {

    const {it} = b.getHooks();

    it('foo', t => {

      console.log('more foo:', t.supply.foo);
      console.log('even more', t.get('my foo'));
    });

  });

});