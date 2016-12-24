const suman = require('suman');
const Test = suman.init(module, {});


Test.describe(__filename, function (assert, child_process) {

    this.before(t => {
        console.log('before');
    });

    this.it(t => {
        assert(true);
    });


    this.it(t => {
        assert(true);
    });


    this.describe('nested describe block', function () {


        this.beforeEach(t => {
            console.log('beforeEach hook should only run once');
        });


        this.it(t => {
            assert(true);
        });

    });


    this.after(t => {

        console.log('after');

    });

});