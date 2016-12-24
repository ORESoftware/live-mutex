const suman = require('suman');
const Test = suman.init(module);


Test.describe('SimpleTest', function (assert, fs, http, os) {


    // this is much better
    this.beforeEach(t => {
        t.data.num = ++t.value;
    });


    this.it('is six', {value: 5}, t => {
        assert.equal(t.data.num, t.value + 1);
    });


    this.it('is nine', {value: 8}, t => {
        assert.equal(t.data.num, t.value + 1);
    });

});