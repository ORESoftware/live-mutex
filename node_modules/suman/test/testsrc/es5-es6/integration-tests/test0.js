

const suman = require('suman');

const Test = suman.init(module, {
    integrants: ['smartconnect', 'dolce-vida'],
    post: ['ugly'],
    interface: 'BDD',
    iocData: createIOCArgs()
});

////////////////////

function createIOCArgs() {

    return {
        roodles: {
            camera: 'man'
        },
        whoa: {
            bob: 'bouche'
        },
        cherry: {
            'wrong': 'number'
        }
    }
}

Test.create.delay('gggg', {parallel: true},

    function (http, assert, fs, child_process, socket_io_client, suite, whoa, cherry, https) {

        setTimeout(() => {
            this.resume(5);
        }, 10);

        this.it.cb('whoa', t => {

            assert.equal(typeof t,'function'); // true
            assert(t instanceof Function);     // true

            t();
        });

        this.beforeEach(function (t) {

            console.log('t instanceof Function (beforeEach)', t instanceof Function);
            console.log('typeof t (beforeEach)', typeof t);

        });

        this.it.cb('makes noise', {}, t => {

            console.log('t instanceof Function (no cb)', t instanceof Function);
            console.log('typeof t (no cb)', typeof t);

            t.once('done', function (a) {
                console.log('t is DONEEEE');
            });

            t.done();
        });

        this.context.delay('moodle', {parallel: true}, function (getResumeValue) {

            const val = getResumeValue();

            this.resume();

            console.log('val:', val);

            this.before.cb(t => {
                setTimeout(t.done, 50);

            });

            this.before.cb(t => {
                setTimeout(t.done, 50);
            });

            this.before.cb(t => {
                setTimeout(t.done, 50);
            });

            this.before(function *() {
                yield new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve('dude');
                    });
                });
            });
        });

        this.describe('moodle', {parallel: true}, function () {

            this.beforeEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            this.beforeEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            }).beforeEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            this.it.cb('mmm1', {parallel: false}, t => {

                setTimeout(function () {
                    t.done();
                }, 50);

            }).it.cb('mmm2', {parallel: false}, (t) => {

                setTimeout(function () {
                    t.done();
                }, 50);

            }).it.cb('mmm3', {parallel: false}, t => {
                setTimeout(function () {
                    t.done();
                }, 50);

            });

            this.beforeEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            this.afterEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            this.afterEach.cb(t => {
                setTimeout(function () {

                    t.done();
                }, 50);
            });

            this.after(function () {

            });

        });


        this.describe('bum', {parallel: true}, function () {


            this.describe('x', function () {

                this.describe('y', function () {

                    this.it.cb('ddd', {parallel: false}, t => {
                        setTimeout(t.done, 50);
                    });

                });

                this.it.cb('cccc', {parallel: false}, t => {
                    setTimeout(t.done, 50);
                });
            });


            const it = this.it;

            it.cb('aaa1', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });

            it.cb('aaa2', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });

            it.cb('aaa3', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });

            it.cb('aaa4', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });

            it.cb('aaa4', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });


            this.after(function () {

            });

        });

        this.after(function () {

        });

    });


Test.create.delay('gggg', {parallel: true},
    function (http, assert, fs, child_process, socket_io_client, suite, whoa, cherry, https) {

        const {describe, it, before, after, beforeEach, afterEach, context} = this;

        setTimeout(() => {
            this.resume(5);
        }, 10);

        beforeEach(function (t) {

        });

        it('makes noise', {}, function () {

        });

        context.delay('moodle', {parallel: true}, function () {

            const {describe, it, before, after, beforeEach, afterEach, context} = this;

            const val = this.getResumeValue();

            console.log(' ==> val ', val);
            this.resume();

            before.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);

            });

            before.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            before.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            before(function *() {
                yield new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve('dude');
                    });
                });
            });
        });

        describe('moodle', {parallel: true}, function () {

            const {describe, it, before, after, beforeEach, afterEach, context} = this;

            beforeEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            beforeEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            beforeEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            it.cb('mmm1', {parallel: false}, t => {

                setTimeout(function () {
                    t.done();
                }, 50);

            });

            it.cb('mmm2', {parallel: false}, (t) => {

                setTimeout(function () {
                    t.done();
                }, 50);

            });

            it.cb('mmm3', {parallel: false}, t => {
                setTimeout(function () {
                    t.done();
                }, 50);

            });

            beforeEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            afterEach.cb(t => {
                setTimeout(function () {
                    t.done();
                }, 50);
            });

            afterEach.cb(t => {
                setTimeout(function () {

                    t.done();
                }, 50);
            });

            after(function () {

            });

        });


        describe('bum', {parallel: true}, function () {

            const {describe, it, before, after, beforeEach, afterEach} = this;


            describe('x', function () {
                const {describe, it} = this;


                describe('y', function () {

                    const {it} = this;

                    it.cb('ddd', {parallel: false}, t => {
                        setTimeout(t.done, 50);
                    });

                });

                it.cb('cccc', {parallel: false}, t => {
                    setTimeout(t.done, 50);
                });

            });


            it.cb('aaa1', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });

            it.cb('aaa2', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });

            it.cb('aaa3', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });

            it.cb('aaa4', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });

            it.cb('aaa4', {parallel: false}, t => {
                setTimeout(t.done, 50);
            });


            after(function () {

            });

        });

        after(function () {

        });

    });
