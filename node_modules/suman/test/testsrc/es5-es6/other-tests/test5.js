/**
 * Created by denman on 12/1/15.
 */


var Test = require('suman').init(module);


Test.describe('suite dos', function (assert) {

    var count = 0;

    this.beforeEach(t => {
        console.log(t.data);
        count++;
    });

    this.beforeEach.cb(t => {
        console.log(t.data);
        count++;
        t.ctn();
    });

    this.beforeEach.cb.skip(t => {
        console.log(t.data);
        count++;
    });

    this.beforeEach.skip.cb(t => {
        console.log(t.data);
        count++;
    });

    this.it('my 888', t => {
        t.data.rooogo = 'bar';
    });

    this.it('my 888', t => {
        t.data.rooogo = 'foo';
    });

    this.afterEach.cb(t => {
        console.log(t.data);
        count++;
        t.done();
    });


    this.afterEach(t => {
        console.log(t.data);
        count++;
    });


    this.afterEach.cb(t => {
        console.log(t.data);
        count++;
        t.done();
    });

    this.after(t => {
        assert(count === 10);
    });


});