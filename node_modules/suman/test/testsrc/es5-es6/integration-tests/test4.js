/**
 * Created by denman on 2/7/2016.
 */



var suman = require('suman');
var Test = suman.init(module, {});

Test.describe.delay('A2', {}, function () {

    var arr = [1, 2];

    const suite = this;

    setTimeout(function () {
        arr.push(4);
        suite.resume();
    }, 100);

    arr.forEach((item)=> {

        this.it('[test]' + item, function (t) {
            console.log('A => ' + t.desc);
        });

    });

    this.before.cb(t => {
        setTimeout(function () {
            t.done();
        }, 100);
    });

    this.describe.delay('B', function () {

        const suite = this;

        setTimeout(function () {
            arr.push(8);
            suite.resume();
        }, 100);

        arr.forEach((item)=> {

            this.it('[test]' + item, t => {
                console.log('B1 => ' + t.desc);
            });

        });

        this.describe('zoom',function () {
            arr.forEach((item)=> {

                this.it('[test]' + item, t => {
                    console.log('B2 => ' + t.desc);
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

                this.it('[test]' + item, t => {
                    console.log('C => ' + t.desc);
                });

            });


            this.describe('D', function () {

                arr.forEach((item)=> {

                    this.it('[test]' + item, t => {
                        console.log('D => ' + t.desc);
                    });

                });

            });
        });

    });

});