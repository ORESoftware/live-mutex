
throw new Error('Before require(suman)');

const suman = require('suman');
const Test = suman.init(module, {});


Test.describe(__filename, {}, function (assert) {

    this.before(t => {
        console.log('before a');
    });


});