const suman = require('suman');
const Test = suman.init(module, {});


console.log('Filename:', Test.file);

Test.describe('Zulu', {mode: 'series'}, function () {


    this.beforeEach(function (t) {
        console.log('before each ' + t.desc);
    });

    this.it('val',{});
    this.it('foo');

    this.describe('A', {parallel: true}, function () {

        this.before(function* () {
            console.log('before ', this.desc);
        });

        this.beforeEach(function *(t) {
            console.log('before each ' + t.desc);
        });


        this.it(this.desc + '1', function (t, done) {
            setTimeout(function () {
                done();
            }, 800);
        });

        this.it(this.desc + '2', function (t, done) {
            setTimeout(function () {
                done();
            }, 800);
        });

        this.after(function () {
            console.log('after 1');
        });

    });

    this.describe('Z', function(){

        this.it('Z1',function(){

        })

    });


    this.describe('B', {parallel: true}, function () {

        this.before(function () {
            console.log('before ', this.desc);
        });

        this.it.skip(this.desc + '1', function (t, done) {
            setTimeout(function () {
                done();
            }, 500);
        });

        this.it.skip(this.desc + '2', function (t, done) {
            setTimeout(function () {
                done();
            }, 500);
        });

    });


    this.describe('C', {parallel: true}, function () {

        this.before(function () {
            console.log('before ', this.desc);
        });


        this.it(this.desc + '1', function (t, done) {
            setTimeout(function () {
                done();
            }, 300);
        });

        this.it(this.desc + '2', function (t, done) {
            setTimeout(function () {
                done();
            }, 300);
        });

        this.describe('M', {parallel: true}, function () {

            this.before(function () {
                console.log('before ', this.desc);
            });

            this.it(this.desc + '1', function (t, done) {
                setTimeout(function () {
                    done();
                }, 500);
            });

            this.it(this.desc + '2', function (t, done) {
                setTimeout(function () {
                    done();
                }, 500);
            });

            this.describe('O', {parallel: true}, function () {

                this.before(function () {
                    console.log('before ', this.desc);
                });

                this.it(this.desc + '1', function (t, done) {
                    setTimeout(function () {
                        done();
                    }, 500);
                });

                this.it(this.desc + '2', function (t, done) {
                    setTimeout(function () {
                        done();
                    }, 500);
                });

                this.describe('P', {parallel: true}, function () {

                    this.before(function () {
                        console.log('before ', this.desc);
                    });

                    this.it(this.desc + '1', function (t, done) {
                        setTimeout(function () {
                            done();
                        }, 500);
                    });

                    this.it(this.desc + '2', function (t, done) {
                        setTimeout(function () {
                            done();
                        }, 500);
                    });

                });
            });

        });

    });


    this.describe('D', {parallel: true}, function () {


        this.before(function () {
            console.log('before ', this.desc);
        });


        this.it(this.desc + '1', function (t, done) {
            setTimeout(function () {
                done();
            }, 100);
        });

        this.it.skip(this.desc + '2', function (t, done) {
            setTimeout(function () {
                done();
            }, 100);
        });

    });

});
