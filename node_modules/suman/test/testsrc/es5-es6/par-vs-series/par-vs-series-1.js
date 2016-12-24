const suman = require('suman');
const Test = suman.init(module, {});


Test.describe('1', {mode: 'parallel'}, function () {

    this.beforeEach(t => {
        t.data.bar = 'foo';
        console.log('t.value:', t.value);
    });

    this.it('one', {value: 5}, t => {
    });

    this.it.cb('two', {value: 4}, t => {
        setTimeout(t.done, 100);
    });

    this.it.cb('three', t => {
        setTimeout(t.done, 100);
    });

    this.it.cb('four', t => {
        setTimeout(t.done, 100);
    });

    this.it.cb('five', t => {
        setTimeout(t.done, 100);
    });

});