

const suman = require('suman');
const Test = suman.init(module, {
    ioc: {
        one: 1
    },
    pre: ['dolce-vida', 'mulch']
});


Test.describe('1', {mode: 'parallel'}, function (william, should, choodles) {

    this.beforeEach(t => {
        t.data.bar = 'foo';
    });

    this.it.cb('one', {value: 5}, t => {
        setTimeout(t.done, 100);
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