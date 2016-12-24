/*
 * */

const suman = require('suman');
const Test = suman.init(module, {
  export: true,
  interface: 'TDD',
  writable: suman.Writable()
});

Test.suite('@Test1', { parallel: false, bail: true }, function (assert, fs, path, stream, extra, writable) {

  writable._write = (chunk, encoding, cb) => {

    console.log(String(chunk));

    this.it('is a string', t => {

      assert(typeof chunk === 'string');

    });
  };

  writable.uncork();
  writable.end();

});
