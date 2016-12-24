/**
 * Created by denman on 1/3/2016.
 */


var Test = require('suman').init(module);


Test.describe('desc', function () {

    this.before(function () {

    });

    var i = 1;

    this.beforeEach(t => {

    });

    this.beforeEach(t => {

    });


    this.describe('a',function () {

        this.beforeEach(t => {


        });

        this.describe('b',function () {


        });


        this.describe('c',function () {

            [1, 2, 3].forEach((val) => {

                this.it('makes>' + val, t => {

                    return Promise.all([
                        new Promise(function (resolve) {
                            resolve('bob');
                        }),
                        new Promise(function (resolve) {
                            resolve('woody');
                        })
                    ]).then(function () {
                        //throw new Error('mike');
                    });

                });
            });
        });


        this.afterEach(t => {

            delete t.data;

        });

    });

    this.afterEach(t => {


    });

    this.afterEach(t => {


    });


});