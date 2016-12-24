const suman = require('suman');
const Test = suman.init(module, {});


Test.describe(__filename, {}, function (assert) {

    this.before({fatal: false}, t => {
        throw new Error('error in hook, should not be fatal.');
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