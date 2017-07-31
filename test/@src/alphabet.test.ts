import suman = require('suman');

const Test = suman.init(module);
const async = require('async');

Test.create(function (assert, before, describe, it, path, Client, Broker, lmUtils, fs, inject) {

  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const a2z = alphabet.split('');
  assert.equal(a2z.length, 26, ' => Western alphabet is messed up.');

  const num = 100;

  const conf = Object.freeze({port: 7028});

  inject(() => {
    return {
      broker: new Broker(conf).ensure()
    }
  });

  let client;

  before('get client', h => {
    return new Client(conf).ensure().then(function (c) {
      client = c;
    });
  });

  const p = path.resolve(__dirname + '/../fixtures/alphabet.test');

  before.cb('clean up file', h => {
    fs.writeFile(p, '', h);
  });

  describe('post', function () {

    before.cb('yo', h => {

      async.each(a2z, function (val, cb) {

        client.lock('foo', function (err, unlock) {

          const strm = fs.createWriteStream(p, {flags: 'a'});

          for (let i = 0; i < num; i++) {
            strm.write(val);
          }

          strm.end();

          strm.once('finish', function () {
            unlock(cb);
          });
        });

      }, h.done);

    });

    it.cb('count characters => expect num*26', {timeout: 300}, t => {

      fs.readFile(p, function (err, data) {
        if (err) {
          return t.done(err);
        }
        else {
          assert.equal(String(data).trim().length, (26 * num));
          t.done();
        }
      });
    });

    it.cb('10 chars of each, in order', {timeout: 300}, t => {

      const readable = fs.createReadStream(p);

      readable.once('error', t.fail);
      readable.once('end', t.done);

      readable.on('readable', function () {

        let index = 0;
        let chunk;
        while (null != (chunk = readable.read(1))) {

          const temp = (index - (index % num)) / num;
          assert.equal(String(chunk), alphabet[temp]);
          index++;
        }

      });
    });

  });

});