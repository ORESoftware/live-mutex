const suman = require('suman');
const Test = suman.init(module, {});


Test.describe(__filename, {}, function (assert) {

    ///////////
    this.before(t => {

    });

    this.before(t => {
        console.error('before a');
    });

    this.beforeEach.cb({}, t => {
        console.log('before each starting...');
        setTimeout(function () {
            console.log('before each hook finished.');
            t.ctn();
        }, 100);

    });

    this.it('a', t => {
        assert(true);
    });


    this.after(t => {
        console.error('after a');
    });


    this.describe('nested group 1', function () {

        this.before(t => {
            console.log('before b');
        });

        this.it('b', t => {
            assert(true);
        });


        this.after(t => {
            console.log('after b');
        });


        this.describe('nested group 2', function () {

            this.before(t => {
                console.log('before c & d');
            });

            this.beforeEach(t => {
                console.log('before each of c & d');
            });

            this.it('c', t => {
                console.error('test passed');
                assert(true);
            });


            this.it('d', t => {
                assert(true);
            });


            this.after(t => {
                console.log('after c & d');
            });

        });


    });


});
