const suman = require('suman');
const Test = suman.init(module, {});


//should exit with non-zero code!

Test.describe(__filename, {}, function (assert) {

    this.before(t => {
        throw new Error('error in hook, should be fatal.');
    });

    this.it('a test', t => {
         assert(true);
    });


});


Test.describe(__filename, {}, function (assert) {

    this.before(t => {
        // no error
    });

    this.it('a test', t => {
        assert(true);
    });


});