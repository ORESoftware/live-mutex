


const suman = require('suman');
const Test = suman.init(module, {});

throw new Error('After suman.init()');


Test.describe(__filename, {}, function (assert) {

    this.before(t => {
        console.log('before a');
    });


});