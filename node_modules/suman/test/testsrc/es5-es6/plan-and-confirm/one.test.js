const suman = require('suman');
const Test = suman.init(module);

Test.create('SimpleTest', { parallel: true }, function (assert, fs, http, os) {


  //synchronous
  this.it('synchronous plan:1',t => {

    t.plan(1);
    t.confirm();

  });

  this.it.cb('callback mode plan:1',t => {

    setTimeout(function(){
      t.plan(1);
      t.confirm();
      t.done();
    },1000);

  });

  this.it('synchronous plan:1',t => {

    t.plan(1);
    t.confirm();

  });

  this.before({ fatal: true, throws: /Expected plan count was/ }, t=> {

    t.plan(3);
    t.confirm();

  });

  this.before({}, t=> {

    t.plan(3);
    t.confirm();
    t.confirm();
    t.confirm();

  });

  this.after(t=> {

    t.plan(1);
    t.confirm();

  });

  this.beforeEach({ plan: 5 }, t=> {

    t.plan(1);
    t.confirm();

  });

  this.afterEach(t=> {

    t.plan(1);
    t.confirm();

  });

});




