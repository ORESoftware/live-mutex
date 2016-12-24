


const suman = require('suman');

throw new Error('Before suman.init()');

const Test = suman.init(module, {});


Test.describe(__filename, {}, function (assert) {

    this.before(t => {
        console.log('before a');
    });


});