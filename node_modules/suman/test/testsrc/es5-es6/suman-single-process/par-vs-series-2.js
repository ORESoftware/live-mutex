const suman = require('suman');
const Test = suman.init(module, {
    pre: ['smartconnect', 'charlie']
});


Test.describe('2', {parallel: true}, function (william, should, choodles, roodles) {


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


Test.describe('3', {parallel: true}, function (william, should, choodles, roodles) {


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

Test.describe('4', {parallel: true}, function (william, should, choodles, roodles) {


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