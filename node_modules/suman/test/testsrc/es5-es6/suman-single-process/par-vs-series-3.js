const suman = require('suman');
const Test = suman.init(module, {
    pre: ['dolce-vida','smartconnect']
});


Test.describe('3', {parallel: true}, function (william, should, choodles) {


    this.it.cb('one', t => {
        setTimeout(t.done, 500);
    });

    this.it.cb('two', t => {
        setTimeout(t.done, 500);
    });

    this.it.cb('three', t => {
        setTimeout(t.done, 500);
    });

    this.it.cb('four', t => {
        setTimeout(t.done, 500);
    });

    this.it.cb('five', t => {
        setTimeout(t.done, 500);
    });

});