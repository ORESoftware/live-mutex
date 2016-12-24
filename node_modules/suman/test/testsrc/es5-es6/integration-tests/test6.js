
'use strict';

var suman = require('suman');
var Test = suman.init(module);

Test.describe.delay('B1', {}, function (socketio, request, roodles, choodles, fs) {


    var arr = [1, 2, 3];

    const suite = this;

    setTimeout(function () {
        arr.push(4);
        arr.push(5);
        arr.push(6);
        suite.resume();
    }, 100);


    this.before.cb(t => {
        setTimeout(function () {
            //console.log('BEFORE');
            t.done();
        }, 100);
    });

    function timeout(charlie) {
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve(charlie || 'yikes');
            }, 100);
        })
    }


    //this.before(async function () {
    //    return await timeout();
    //});


    this.beforeEach.cb(t=> {
        // console.log('TTTTTTT:', t);
        // console.log('DDDDD:', done);
        // console.log('RRRRR:', run);
        t.done();
        //t.data.lion = await timeout();
    });

    this.beforeEach(t => {
        t.data.lion = 'barb';
    });


    this.beforeEach.cb(t => {

        setTimeout(function () {
            //console.log('BEFORE EACH');
            t.done();
        }, 100);

    });

    this.describe.delay('B', function () {

        const suite = this;

        setTimeout(function () {
            arr.push(8);
            suite.resume();
        }, 100);

        this.describe('bam',function () {

            arr.forEach((item)=> {
                this.it('[test]' + item, function (t) {
                    console.log('B => ' + t.desc, t.data.lion);
                });

            });
        });
    });

    this.describe.delay('C', function () {

        setTimeout(() => {
            arr.push(9);
            this.resume();
        }, 100);

        this.describe.delay('j', function () {

            setTimeout(() => {
                arr.push(13);
                this.resume();
            }, 100);

            arr.forEach((item)=> {

                this.it('[test]' + item, function (t) {
                    console.log('C => ' + t.desc);
                });

            });


            this.describe('D', function () {

                arr.forEach((item)=> {

                    this.it('[test]' + item, function (t) {
                        console.log('D => ' + t.desc);
                    });

                });

            });
        });

    });

});