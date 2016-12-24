/**
 * Created by denman on 1/3/2016.
 */


var Test = require('suman').init(module);



Test.describe('A describe', {parallel: true}, function () {


    this.after.cb(t => {
        t.done();
    });

    this.describe('B describe', function () {

        this.after.cb(t => {
            t.done();
        });

        this.it('b1 test', {parallel: false}, (t) => {

        });

        this.it('b2 test', function () {

        });

        this.it('b3 test', function () {

        });

        this.it('b4 test', function () {

        });

        this.describe('C', function () {

            this.after.cb(t => {
                t.done();
            });
        });

    });

    this.describe('D describe', function () {


        this.after.cb(t => {
            t.done();
        });

        this.it('d1 test', function () {

        });

        this.it('d2 test', function () {

        });


        this.describe('E', function () {

            this.it('e1 test', t => {

            });

            this.it('e2 test', t => {

            });

            this.it('e3 test', t => {

            });

            this.after.cb(t => {
                t.done();
            });
        });
    });

    this.describe('F', function () {
        this.after.cb(t => {
            t.done();
        });

        this.describe('G', function () {

            this.it.cb('mmm2', {parallel: false}, t => {
                t.done();
            });

            this.after.cb(t => {
                t.done();
            });
        });
    });


    this.describe('moodle', {parallel: false}, function () {

        this.after.cb(t => {
            t.done();
        });


        this.it.cb('mmm1', {parallel: false}, t => {
            t.done();
        });


        this.after.cb.skip(t => {
            console.log('dingy');
            t.done();
        });


    });


    this.it.cb('a test', {parallel: false}, t => {
        t.done();
    });

    this.after.cb(t => {
        t.done();
    });


    this.after.cb(t => {
        t.done();
    });


});