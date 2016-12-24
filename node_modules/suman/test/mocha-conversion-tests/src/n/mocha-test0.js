/**
 * Created by denmanm1 on 3/20/16.
 */

var assert = require("assert"),
    fs = require('fs');


describe('a', function () {


    after(function (d) {

        console.log('before this a:', this.parent);

    });

    beforeEach(function () {

        console.log('beforeEach this a:', this.parent);

    });


    it('a', function (done) {

        console.log('it this a:', this.parent);

        done();

    });


    describe('b', function () {

        before(function () {

            console.log('before this b:', this.parent);

        });

        beforeEach(function () {

            console.log('beforeEach this b:', this.parent);
            this.parent.title;


        });


        it('b', function (done) {

            console.log('it this b:', this.parent);
            done();

        });


    });


});
