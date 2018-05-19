import suman = require('suman');
const Test = suman.init(module);

/////////////////////////////////////////////////////

Test.create({mode: 'parallel'}, ['Client', 'lmUtils', function (b, assert, before, it) {
  
  const {lmUtils, Client} = b.ioc;
  const conf = Object.freeze({port: 7888});
  
  before('promise', function () {
    return lmUtils.conditionallyLaunchSocketServerp(conf);
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
  
}]);