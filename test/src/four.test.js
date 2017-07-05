const suman = require('suman');
const Test = suman.init(module);
const Promise = require('bluebird');

Test.create({mode: 'parallel'}, function (assert, before, it, Client, lmUtils) {

  const conf = Object.freeze({port: 7987});

  before('promise', function () {

    return lmUtils.conditionallyLaunchSocketServer(conf)
    .then(function (data) {
      return Promise.delay(30);
    }, function (err) {
      if (err) {
        console.error(err.stack);
      }
      else {
        throw new Error('no error passed to reject handler');
      }

    });

  });

  it.cb('yes', {timeout: 300}, t => {

    Client.create(conf, (err, c) => {
      if (err) return t.fail(err);
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });

  });

  it.cb('yes', {timeout: 300}, t => {

    const c = new Client(conf);

    c.ensure().then(function () {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });
  });

  it.cb('yes', {timeout: 300}, t => {

    return Client.create(conf).then(c => {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });

  });

  it.cb('yes', {timeout: 300}, t => {

    Client.create(conf).then(c => {
      c.lock('z', function (err) {
        if (err) return t(err);
        c.unlock('z', t);
      });
    });

  });

});