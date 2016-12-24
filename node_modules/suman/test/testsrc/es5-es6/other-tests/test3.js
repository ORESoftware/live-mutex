/**
 * Created by denman on 12/2/2015.
 */


var suman = require('suman');
var Test = suman.init(module);

Test.describe('foo', function () {

    this.before(t => {

    });


    this.after(t => {

    });


    this.it.cb('4', t => {

        setTimeout(function () {
            t.done();
        }, 1000);

    });

    this.beforeEach.cb(t => {
        t.done();
    });


    this.describe('2', function () {

        this.before(t => {

        });


        this.describe('3', {parallel: true}, function () {


            this.beforeEach(t => {

            });

            this.it.cb('it 5555', t => {

                setTimeout(function () {
                    t.done();
                }, 1000);

            });

            this.it.cb('66666six', t => {

                setTimeout(function () {
                    t.done();
                }, 1000);

            });

            this.after(t => {

            });

        });

        this.after(t => {

        });

    });

    this.after(t => {

    });


});