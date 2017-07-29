import suman = require('suman');
const Test = suman.init(module);

/////////////////////////////////////////////////////

Test.create({mode: 'parallel'}, function (assert, before, it, Client, lmUtils) {

  const conf = Object.freeze({port: 7888});

  before('promise', function () {

    return lmUtils.conditionallyLaunchSocketServer(conf)
    .then(null, function (err) {
      if (err) {
        console.error(err.stack);
      }
      else {
        throw new Error('no error passed to reject handler');
      }

    });

  });

  it.cb('yes', {timeout: 30000}, t => {

    const client = new Client(conf, () => {
      client.lock('z', function (err) {
        if (err) return t(err);
        client.unlock('z', t);
      });
    });

  });

  it.cb('yes', {timeout: 30000}, t => {

    new Client(conf, function () {
      this.lock('z', function (err) {
        if (err) return t(err);
        this.unlock('z', t.done);
      });
    });

  });

  it.cb('yes', {timeout: 30000}, t => {

    const client = new Client(conf);
    client.ensure(function () {
      client.lock('z', function (err) {
        if (err) return t(err);
        client.unlock('z', t);
      });
    });

  });

  it.cb('yes', {timeout: 30000}, t => {

    const client = new Client(conf);
    client.ensure().then(function (c) {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t.done);
      });
    });

  });

});