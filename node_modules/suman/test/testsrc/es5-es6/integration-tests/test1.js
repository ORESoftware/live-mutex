
const suman = require('suman');
const Test = suman.init(module, {
    interface: 'BDD',
    post: ['judas'],
    series: true,
    integrants: ['smartconnect', 'dolce-vida']
});

///////////

Test.describe('suite uno', {}, function () {


    this.it.cb('foo2', {parallel: true}, t => {

        var z = function farout(){

        };
        
        t();
    });


    this.it.cb('bar2', {parallel: false}, t => {
        t.done();
    });


    this.it.cb('baz2', {parallel: true}, t => {
          t.apply();
    });


    this.describe('suite five', {parallel: true}, function () {

        this.before(function () {

        }).after(() => {

        });

        this.it.cb('makes stuff 20', t => {

            setTimeout(function () {
                t.done();
            }, 10);

        });

        this.it('makes stuff 21', t => {


        });

        this.it('makes stuff 22', t => {

            //console.log('this:',this);

        }).after(() => {


        });


    });

    this.describe('suite two', function () {

        this.describe('suite three', {parallel: true}, function () {

            this.before(function () {

            }).after(function () {

            });


            this.it('makes stuff 16', function () {

            });

            this.it('makes stuff 17', function () {

            });

        });


        this.describe('suite four', function () {


            this.before.cb(t => {
                t.done();

            }).beforeEach(() => {


            }).after(() => {


            }).it.cb('makes stuff 18', t => {

                t.done();

            });

            this.it.cb('makes stuff 19', t => {

                t.done();

            }).afterEach(() => {


            });


        });

    });

});


