const suman = require('suman');
const Test = suman.init(module, {});


Test.describe(__filename, function (assert) {

    this.before(t => {
        console.log('before');
    });

    this.it(t => {
        assert(true);
    });


    this.after(t => {
        console.log('after');
    });

});